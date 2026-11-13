CREATE TABLE wordbook(id TEXT PRIMARY KEY,student TEXT NOT NULL,kind TEXT NOT NULL,text TEXT NOT NULL,norm TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',context TEXT NOT NULL DEFAULT '',source_kind TEXT NOT NULL,source_id TEXT NOT NULL DEFAULT '',source_title TEXT NOT NULL DEFAULT '',annotation TEXT,mastered INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE UNIQUE INDEX idx_wordbook_entry ON wordbook(student,kind,norm);
CREATE INDEX idx_wordbook_student ON wordbook(student,updated);
CREATE INDEX idx_wordbook_annotation ON wordbook(annotation);
INSERT OR IGNORE INTO wordbook(id,student,kind,text,norm,note,context,source_kind,source_id,source_title,annotation,mastered,created,updated) SELECT 'a-'||a.id,a.student,a.kind,a.text,lower(trim(a.text)),a.note,'','task',a.task,coalesce(json_extract(t.material,'$.title'),''),a.id,0,a.created,a.updated FROM annotations a JOIN tasks t ON t.id=a.task WHERE a.kind IN ('word','sentence');
