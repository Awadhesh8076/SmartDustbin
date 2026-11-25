import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    PROJECT_NAME: str = "SmartDustbin AI & IoT Platform"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Base Directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    ROOT_DIR: Path = BASE_DIR.parent
    STORAGE_DIR: Path = ROOT_DIR / "storage"
    SCANS_DIR: Path = STORAGE_DIR / "scans"
    DATASET_DIR: Path = STORAGE_DIR / "dataset"
    MODEL_DIR: Path = STORAGE_DIR / "model"
    
    # Database
    DATABASE_URL: str = f"sqlite:///{STORAGE_DIR / 'smartdustbin.db'}"
    
    # Hardware Defaults
    DEFAULT_ESP32_CAM_IP: str = "192.168.4.1"
    DEFAULT_ESP32_DEVKIT_IP: str = "192.168.4.1"
    DEFAULT_MODE: str = "REAL_HARDWARE"
    
    # AI Hyperparameters (Ported from Unity AIConfig.cs)
    INPUT_WIDTH: int = 128
    INPUT_HEIGHT: int = 128
    HIGH_CONFIDENCE_THRESHOLD: float = 0.80
    MIN_CONFIDENCE_THRESHOLD: float = 0.60
    MEMORY_MATCH_THRESHOLD: float = 0.70  # Pearson correlation r >= 0.70
    SAMPLES_BEFORE_UPDATE: int = 20
    
    # Rewards Table (Ported from Unity CoinManager.cs)
    REWARD_METAL: int = 5
    REWARD_PLASTIC: int = 3
    REWARD_DRY: int = 2
    REWARD_WET: int = 1

settings = Settings()

# Ensure directories exist
for path in [settings.STORAGE_DIR, settings.SCANS_DIR, settings.DATASET_DIR, settings.MODEL_DIR]:
    path.mkdir(parents=True, exist_ok=True)
