from sqlalchemy import text

from api.database import Base, engine

# Import all models so SQLAlchemy knows which tables to create.
from api.models import classroom as classroom_models
from api.models import exam as exam_models
from api.models import ocr as ocr_models
from api.models import submission as submission_models
from api.models import user as user_models


def run_statements(statements: list[str]) -> None:
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_question_columns() -> None:
    run_statements([
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(30) DEFAULT 'descriptive' NOT NULL",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS options JSON",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_option VARCHAR(255)",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_options JSON",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN DEFAULT FALSE",
        "ALTER TABLE questions ALTER COLUMN model_answer DROP NOT NULL",
    ])


def ensure_exam_access_table() -> None:
    run_statements([
        """
        CREATE TABLE IF NOT EXISTS exam_access (
            id SERIAL PRIMARY KEY,
            exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
        )
        """,
    ])


def ensure_user_settings_columns() -> None:
    run_statements([
        "DROP TABLE IF EXISTS otp_verifications",
        "ALTER TABLE users DROP COLUMN IF EXISTS is_verified",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS institution VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_path VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_submissions BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_low_scores BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_ocr_review BOOLEAN DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS default_question_marks INTEGER DEFAULT 10",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS release_marks_immediately BOOLEAN DEFAULT TRUE",
    ])


def ensure_evaluation_similarity_columns() -> None:
    run_statements([
        "ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS peer_similarity NUMERIC(5, 2) DEFAULT 0",
        "ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS similar_submission_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL",
        "ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS review_requested BOOLEAN DEFAULT FALSE",
        "ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS teacher_review_note TEXT",
    ])


def initialize_database() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_question_columns()
    ensure_exam_access_table()
    ensure_user_settings_columns()
    ensure_evaluation_similarity_columns()
