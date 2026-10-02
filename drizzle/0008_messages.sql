CREATE TABLE messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student TEXT NOT NULL REFERENCES accounts(id),
 author TEXT NOT NULL CHECK(author IN ('teacher','student')),
 body TEXT NOT NULL,
 created TEXT NOT NULL,
 read_at TEXT
);
CREATE INDEX idx_messages_student ON messages(student,id);
