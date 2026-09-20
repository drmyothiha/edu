package config

import (
	"os"
	"strconv"
	"time"
)

// Config contains application configuration settings
type Config struct {
	Port          string
	DatabaseURL   string
	JWTSecret     string
	JWTExpiration time.Duration
	LLMProvider   string
	LLMAPIKey     string
	LLMBaseURL    string
	LLMModel      string
	Environment   string
}

// Load loads configuration from environment variables with fallback defaults
func Load() *Config {
	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/edu_db?sslmode=disable")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-edu-platform-jwt-signing-key-32b!")
	
	expHoursStr := getEnv("JWT_EXPIRATION_HOURS", "24")
	expHours, err := strconv.Atoi(expHoursStr)
	if err != nil || expHours <= 0 {
		expHours = 24
	}

	llmProvider := getEnv("LLM_PROVIDER", "mock")
	llmAPIKey := getEnv("LLM_API_KEY", "")
	llmBaseURL := getEnv("LLM_BASE_URL", "https://api.openai.com/v1")
	llmModel := getEnv("LLM_MODEL", "gpt-4o-mini")
	env := getEnv("APP_ENV", "development")

	return &Config{
		Port:          port,
		DatabaseURL:   dbURL,
		JWTSecret:     jwtSecret,
		JWTExpiration: time.Duration(expHours) * time.Hour,
		LLMProvider:   llmProvider,
		LLMAPIKey:     llmAPIKey,
		LLMBaseURL:    llmBaseURL,
		LLMModel:      llmModel,
		Environment:   env,
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
