import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "learning",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "smart_language_learning"),
        "USER": os.getenv("POSTGRES_USER", "smart_language_learning"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "smart_language_learning"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": int(os.getenv("POSTGRES_PORT", "5432")),
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
}

CORS_ALLOW_ALL_ORIGINS = True

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_QUESTION_MODEL = os.getenv("OPENAI_QUESTION_MODEL", "").strip()
if not OPENAI_QUESTION_MODEL:
    raise ImproperlyConfigured("OPENAI_QUESTION_MODEL is required")
OPENAI_REQUEST_TIMEOUT_SECONDS = int(os.getenv("OPENAI_REQUEST_TIMEOUT_SECONDS", "30"))
OPENAI_TTS_REQUEST_TIMEOUT_SECONDS = int(os.getenv("OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", "40"))
OPENAI_TTS_DIALOG_ACCENT = os.getenv("OPENAI_TTS_DIALOG_ACCENT", "Leipzig German").strip()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "").strip()
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2").strip()
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
ELEVENLABS_VOICE_IDS = os.getenv("ELEVENLABS_VOICE_IDS", "").strip()
ELEVENLABS_DIALOG_VOICE_IDS = os.getenv("ELEVENLABS_DIALOG_VOICE_IDS", "").strip()
ELEVENLABS_OUTPUT_FORMAT = os.getenv("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128").strip()
ELEVENLABS_PCM_OUTPUT_FORMAT = os.getenv("ELEVENLABS_PCM_OUTPUT_FORMAT", "pcm_24000").strip()
AUDIO_TTS_PROVIDER = os.getenv("AUDIO_TTS_PROVIDER", "openai").strip().lower()
OPENAI_IMAGE_REQUEST_TIMEOUT_SECONDS = int(os.getenv("OPENAI_IMAGE_REQUEST_TIMEOUT_SECONDS", "120"))
AUDIO_STORAGE_BACKEND = os.getenv("AUDIO_STORAGE_BACKEND", "local").strip().lower()
AWS_S3_AUDIO_BUCKET = os.getenv("AWS_S3_AUDIO_BUCKET", "").strip()
AWS_S3_AUDIO_PREFIX = os.getenv("AWS_S3_AUDIO_PREFIX", "audio").strip().strip("/")
AWS_S3_AUDIO_REGION = os.getenv("AWS_S3_AUDIO_REGION", os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", ""))).strip()
AWS_S3_AUDIO_BASE_URL = os.getenv("AWS_S3_AUDIO_BASE_URL", "").strip().rstrip("/")
IMAGE_STORAGE_BACKEND = os.getenv("IMAGE_STORAGE_BACKEND", AUDIO_STORAGE_BACKEND).strip().lower()
AWS_S3_IMAGE_BUCKET = os.getenv("AWS_S3_IMAGE_BUCKET", AWS_S3_AUDIO_BUCKET).strip()
AWS_S3_IMAGE_PREFIX = os.getenv("AWS_S3_IMAGE_PREFIX", "exercise-images").strip().strip("/")
AWS_S3_IMAGE_REGION = os.getenv("AWS_S3_IMAGE_REGION", AWS_S3_AUDIO_REGION).strip()
AWS_S3_IMAGE_BASE_URL = os.getenv("AWS_S3_IMAGE_BASE_URL", "").strip().rstrip("/")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "loggers": {
        "learning.views.content": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
