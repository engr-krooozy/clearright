from google.adk.agents import Agent
from google.adk.tools import google_search
from google.genai.types import GenerateContentConfig

from .prompts import AGENT_INSTRUCTION

genai_config = GenerateContentConfig(
    temperature=0.3,
)

root_agent = Agent(
    name="clara_legal_assistant",
    model="gemini-2.5-flash-native-audio-latest",
    description="Clara — a compassionate legal information assistant that helps Americans understand their legal documents and know their rights.",
    instruction=AGENT_INSTRUCTION,
    tools=[google_search],
    generate_content_config=genai_config,
)
