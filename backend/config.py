from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # API keys
    public_data_api_key: str = ""   # 공공데이터포털 (data.go.kr)
    seoul_api_key: str = ""         # 서울 열린데이터광장 (data.seoul.go.kr)

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "spicemap"
    db_user: str = "postgres"
    db_password: str = "postgres"

    # Redis
    redis_url: str = "redis://localhost:6379"

    @property
    def database_url(self) -> str:
        base = (
            f"postgresql+psycopg2://{self.db_user}:{quote_plus(self.db_password)}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )
        # Supabase 등 원격 DB는 SSL 필요, 로컬은 불필요
        if self.db_host in ("localhost", "127.0.0.1"):
            return base
        return base + "?sslmode=require"


settings = Settings()
