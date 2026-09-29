-- name: CreateConversation :one
INSERT INTO conversations (school_id, teacher_id, parent_id, student_id, last_message_at)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (teacher_id, parent_id, student_id)
DO UPDATE SET last_message_at = NOW()
RETURNING id, school_id, teacher_id, parent_id, student_id, last_message_at, created_at;

-- name: GetConversationByID :one
SELECT c.id, c.school_id, c.teacher_id, c.parent_id, c.student_id, c.last_message_at, c.created_at,
       t.full_name as teacher_name, t.email as teacher_email,
       p.full_name as parent_name, p.email as parent_email,
       COALESCE(s.full_name, '') as student_name
FROM conversations c
JOIN users t ON t.id = c.teacher_id
JOIN users p ON p.id = c.parent_id
LEFT JOIN users s ON s.id = c.student_id
WHERE c.id = $1;

-- name: ListUserConversations :many
SELECT c.id, c.school_id, c.teacher_id, c.parent_id, c.student_id, c.last_message_at, c.created_at,
       t.full_name as teacher_name, t.email as teacher_email,
       p.full_name as parent_name, p.email as parent_email,
       COALESCE(s.full_name, '') as student_name,
       COALESCE((SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), '')::text as latest_message_content,
       COALESCE((SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), c.created_at) as latest_message_at,
       COALESCE((SELECT COUNT(*)::bigint FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_id != $1), 0)::bigint as unread_count
FROM conversations c
JOIN users t ON t.id = c.teacher_id
JOIN users p ON p.id = c.parent_id
LEFT JOIN users s ON s.id = c.student_id
WHERE c.teacher_id = $1 OR c.parent_id = $1
ORDER BY c.last_message_at DESC;

-- name: CreateMessage :one
INSERT INTO messages (conversation_id, sender_id, content, is_read)
VALUES ($1, $2, $3, FALSE)
RETURNING id, conversation_id, sender_id, content, is_read, created_at;

-- name: TouchConversation :exec
UPDATE conversations
SET last_message_at = NOW()
WHERE id = $1;

-- name: ListMessagesByConversation :many
SELECT m.id, m.conversation_id, m.sender_id, m.content, m.is_read, m.created_at,
       u.full_name as sender_name, u.role as sender_role
FROM messages m
JOIN users u ON u.id = m.sender_id
WHERE m.conversation_id = $1
ORDER BY m.created_at ASC;

-- name: MarkMessagesAsRead :exec
UPDATE messages
SET is_read = TRUE
WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE;

-- name: CreateAnnouncement :one
INSERT INTO announcements (class_id, teacher_id, title, content, priority)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, class_id, teacher_id, title, content, priority, created_at;

-- name: ListAnnouncementsByClass :many
SELECT a.id, a.class_id, a.teacher_id, a.title, a.content, a.priority, a.created_at,
       u.full_name as teacher_name, c.name as class_name
FROM announcements a
JOIN users u ON u.id = a.teacher_id
JOIN classes c ON c.id = a.class_id
WHERE a.class_id = $1
ORDER BY a.created_at DESC;

-- name: ListAnnouncementsForParent :many
SELECT DISTINCT a.id, a.class_id, a.teacher_id, a.title, a.content, a.priority, a.created_at,
       u.full_name as teacher_name, c.name as class_name, s.full_name as student_name
FROM announcements a
JOIN classes c ON c.id = a.class_id
JOIN users u ON u.id = a.teacher_id
JOIN class_enrollments ce ON ce.class_id = c.id
JOIN users s ON s.id = ce.student_id
WHERE s.parent_id = $1
ORDER BY a.created_at DESC;

-- name: CreateNotification :one
INSERT INTO notifications (user_id, type, title, body, data, is_read)
VALUES ($1, $2, $3, $4, $5, FALSE)
RETURNING id, user_id, type, title, body, data, is_read, created_at;

-- name: ListNotificationsByUser :many
SELECT id, user_id, type, title, body, data, is_read, created_at
FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountUnreadNotifications :one
SELECT COUNT(*)::bigint AS unread_count
FROM notifications
WHERE user_id = $1 AND is_read = FALSE;

-- name: MarkNotificationAsRead :exec
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND user_id = $2;

-- name: MarkAllNotificationsAsRead :exec
UPDATE notifications
SET is_read = TRUE
WHERE user_id = $1 AND is_read = FALSE;

-- name: ListParentsByClassID :many
SELECT DISTINCT p.id, p.email, p.full_name
FROM class_enrollments ce
JOIN users s ON s.id = ce.student_id
JOIN users p ON p.id = s.parent_id
WHERE ce.class_id = $1 AND s.parent_id IS NOT NULL;

-- name: GetParentByStudentID :one
SELECT p.id, p.email, p.full_name
FROM users s
JOIN users p ON p.id = s.parent_id
WHERE s.id = $1 AND s.parent_id IS NOT NULL;

-- name: GetTeacherByStudentID :one
SELECT DISTINCT u.id, u.email, u.full_name, c.id as class_id, c.name as class_name
FROM class_enrollments ce
JOIN classes c ON c.id = ce.class_id
JOIN users u ON u.id = c.teacher_id
WHERE ce.student_id = $1
LIMIT 1;

-- name: UpsertDeviceToken :one
INSERT INTO user_device_tokens (user_id, fcm_token, platform, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (fcm_token)
DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()
RETURNING id, user_id, fcm_token, platform, created_at, updated_at;

-- name: DeleteDeviceToken :exec
DELETE FROM user_device_tokens
WHERE fcm_token = $1;

-- name: DeleteUserDeviceToken :exec
DELETE FROM user_device_tokens
WHERE user_id = $1 AND fcm_token = $2;

-- name: ListDeviceTokensByUserID :many
SELECT id, user_id, fcm_token, platform, created_at, updated_at
FROM user_device_tokens
WHERE user_id = $1;
