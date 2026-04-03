USE clouddesk;

-- 5 users (3 regular, 2 admins)
INSERT INTO users (name, email, password_hash, role) VALUES
('Alice Tan', 'alice@test.com', 'hash001', 'user'),
('Bob Lim', 'bob@test.com', 'hash002', 'user'),
('Charlie Ng', 'charlie@test.com', 'hash003', 'user'),
('Admin Sara', 'sara@test.com', 'hash004', 'admin'),
('Admin James', 'james@test.com', 'hash005', 'admin');

-- 5 tickets (mix of users, statuses, priorities)
INSERT INTO tickets (user_id, assigned_to, title, description, status, priority) VALUES
(1, 4, 'Cannot login to portal', 'Getting invalid credentials error', 'in_progress', 'high'),
(2, 4, 'Page not loading', 'Dashboard shows blank screen', 'open', 'medium'),
(3, 5, 'Wrong email displayed', 'My profile shows wrong email', 'resolved', 'low'),
(1, 5, 'File upload fails', 'PDF upload gives 500 error', 'open', 'high'),
(2, NULL, 'Slow response time', 'System very laggy in the afternoon', 'closed', 'medium');

-- 5 responses (mix of admin and user replies)
INSERT INTO ticket_responses (ticket_id, responder_id, message) VALUES
(1, 4, 'Hi Alice, please try resetting your password and clearing cache.'),
(1, 1, 'I tried that, still not working.'),
(2, 4, 'Hi Bob, we are looking into this issue.'),
(3, 3, 'Thanks, the email is now correct.'),
(4, 5, 'Hi Alice, please check your file size is under 10MB.');

-- 5 attachments (across different tickets)
INSERT INTO attachments (ticket_id, file_name, s3_key) VALUES
(1, 'error_screenshot.png', 'uploads/ticket-1/error_screenshot.png'),
(2, 'blank_screen.png', 'uploads/ticket-2/blank_screen.png'),
(4, 'upload_error.png', 'uploads/ticket-4/upload_error.png'),
(4, 'network_log.txt', 'uploads/ticket-4/network_log.txt'),
(5, 'performance_report.pdf', 'uploads/ticket-5/performance_report.pdf');

-- View all tables
SELECT * FROM users;
SELECT * FROM tickets;
SELECT * FROM ticket_responses;
SELECT * FROM attachments;

-- Bonus: join query to see tickets with their submitter name
SELECT t.id, u.name AS submitted_by, t.title, t.status, t.priority
FROM tickets t
JOIN users u ON t.user_id = u.id;

-- USE clouddesk;
-- SET SQL_SAFE_UPDATES = 0;

-- DELETE FROM attachments;
-- DELETE FROM ticket_responses;
-- DELETE FROM tickets;
-- DELETE FROM users;

-- Reset auto increment back to 1
-- ALTER TABLE attachments AUTO_INCREMENT = 1;
-- ALTER TABLE ticket_responses AUTO_INCREMENT = 1;
-- ALTER TABLE tickets AUTO_INCREMENT = 1;
-- ALTER TABLE users AUTO_INCREMENT = 1;