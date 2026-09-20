package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/config"
	"edu-platform/internal/copilot"
	"edu-platform/internal/database"
	"edu-platform/internal/school"
	"edu-platform/internal/server"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// 1. Initialize structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// 2. Load application configuration
	cfg := config.Load()
	logger.Info("starting education platform API service",
		"port", cfg.Port,
		"env", cfg.Environment,
		"llm_provider", cfg.LLMProvider,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 3. Connect to PostgreSQL connection pool
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		logger.Error("unable to parse database configuration", "error", err)
		os.Exit(1)
	}

	poolConfig.MaxConns = 25
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 1 * time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		logger.Error("failed to create database connection pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Ping database
	pingCtx, pingCancel := context.WithTimeout(ctx, 5*time.Second)
	defer pingCancel()

	if err := pool.Ping(pingCtx); err != nil {
		logger.Warn("database ping failed (service running; verify PostgreSQL connection)", "error", err)
	} else {
		logger.Info("connected to PostgreSQL successfully")

		// Run migrations on start if configured
		if os.Getenv("AUTO_MIGRATE") == "true" || os.Getenv("MIGRATE_ON_START") == "true" {
			migrationsDir := "db/migrations"
			if _, err := os.Stat(migrationsDir); err == nil {
				logger.Info("applying database schema migrations", "dir", migrationsDir)
				if err := database.RunMigrations(ctx, pool, migrationsDir); err != nil {
					logger.Error("database migration failed", "error", err)
				} else {
					logger.Info("database schema migrations applied successfully")
				}
			}
		}
	}

	// 4. Initialize sqlc querier
	querier := database.New(pool)

	// 5. Initialize Auth service & handlers
	jwtManager := auth.NewJWTManager(cfg.JWTSecret, cfg.JWTExpiration, "edu-platform")
	authService := auth.NewService(querier, jwtManager)
	authHandler := auth.NewHandler(authService)
	authMiddleware := auth.NewMiddleware(jwtManager)

	// 6. Initialize Copilot service & handlers
	llmClient := copilot.NewLLMClientFactory(cfg.LLMProvider, cfg.LLMAPIKey, cfg.LLMBaseURL, cfg.LLMModel)
	copilotService := copilot.NewService(querier, llmClient)
	copilotHandler := copilot.NewHandler(copilotService)

	// 7. Initialize School domain service & handlers
	schoolService := school.NewService(querier)
	schoolHandler := school.NewHandler(schoolService)

	// 8. Construct Chi HTTP router
	router := server.NewRouter(server.RouterConfig{
		AuthHandler:    authHandler,
		AuthMiddleware: authMiddleware,
		SchoolHandler:  schoolHandler,
		CopilotHandler: copilotHandler,
	})

	// 9. Setup HTTP server with production timeouts
	httpServer := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErrors := make(chan error, 1)

	// Run HTTP server
	go func() {
		logger.Info("HTTP server listening", "addr", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	// 10. Graceful shutdown listening for OS signals
	shutdownSignal := make(chan os.Signal, 1)
	signal.Notify(shutdownSignal, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-serverErrors:
		logger.Error("server fatal error", "error", err)
		os.Exit(1)
	case sig := <-shutdownSignal:
		logger.Info("shutdown signal received", "signal", sig.String())

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer shutdownCancel()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			logger.Error("graceful shutdown failed; closing server", "error", err)
			_ = httpServer.Close()
		}

		logger.Info("server shutdown gracefully completed")
	}
}
