from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    vocal_bridge_api_key: str = ""
    vb_agent_id: str = ""
    sabre_mcp_url: str = "https://mcp.cert.sabre.com/mcp"
    sabre_mcp_skills_url: str = "https://mcp2.cert.sabre.com/mcp"
    sabre_token: str = ""
    sabre_pcc: str = "S5OM"
    sabre_mode: str = "fixture"
    anthropic_api_key: str = ""
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base: str = "https://api-m.sandbox.paypal.com"


settings = Settings()
