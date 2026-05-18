import ollama
import os

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

SYSTEM_PROMPT = """You are a creative director writing image generation prompts for a music video.
Given song lyrics, style tags, and global context, write a single vivid scene description.
Output only the prompt text — no explanation, no labels, no quotes.
Keep it under 120 words. Focus on visual detail: lighting, environment, mood, camera angle."""


async def generate_scene_prompt(
    lyrics: str,
    style_tags: list[str],
    global_context: dict,
    trigger_word: str,
) -> str:
    """
    Use local Ollama LLM to generate a ComfyUI scene prompt.
    Falls back to a simple template if Ollama is unavailable.
    """
    style_str = ", ".join(style_tags) if style_tags else "cinematic"

    user_message = f"""Lyrics for this scene: "{lyrics}"

Style tags: {style_str}
Story concept: {global_context.get('story_concept', '')}
Locations: {global_context.get('locations', '')}
Character trigger word: {trigger_word}

Write a scene prompt for this moment in the music video."""

    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
        )
        return response["message"]["content"].strip()
    except Exception:
        # Fallback: simple template if Ollama not available
        return f"{trigger_word}, {style_str}, cinematic shot, high detail, 8k"
