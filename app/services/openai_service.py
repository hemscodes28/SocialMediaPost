import base64
import json
import logging
import re
from typing import Dict, Optional

from openai import AsyncOpenAI, AuthenticationError, RateLimitError, APIConnectionError
from app.config import settings

logger = logging.getLogger(__name__)


class CaptionGenerationError(Exception):
    """User-facing caption generation failure with HTTP status hint."""

    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class OpenAICaptionService:
    """Generate platform-specific captions and hashtags using OpenAI."""

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.client = AsyncOpenAI(api_key=self.api_key) if self.api_key else None

    def _encode_image(self, image_path: str) -> str:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")

    async def generate_caption(
        self,
        platform: str,
        topic: Optional[str] = None,
        image_path: Optional[str] = None,
    ) -> Dict:
        if not self.client:
            raise CaptionGenerationError(
                "OpenAI API key is missing. Add OPENAI_API_KEY to your .env file and restart the server.",
                status_code=503,
            )

        platform = platform.lower()

        system_prompt = (
            "You are a social media expert. Your task is to write high-quality, engaging captions.\n"
            "Return only the final caption with hashtags at the end.\n"
            "Do not include preamble like 'Here is your caption:'."
        )

        platform_rules = {
            "instagram": "Write a fun, engaging Instagram caption. Use emojis. Include exactly 5 relevant hashtags.",
            "linkedin": (
                "Write a professional, viral-style LinkedIn post. Structure:\n"
                "1. A strong opening Hook line to grab attention.\n"
                "2. 2-3 short, insightful paragraphs providing value or context.\n"
                "3. A Call-to-Action at the end.\n"
                "Tone: Visionary, professional, yet readable. Include 4-5 relevant industry hashtags."
            ),
            "threads": "Write a short, punchy, conversational, and direct Threads post. Emojis welcome, limit hashtags to 0 or 1 relevant hashtags.",
        }

        rule = platform_rules.get(platform, platform_rules["instagram"])

        if topic:
            prompt_text = f"{rule}\n\nTopic/Context: {topic}"
        elif image_path:
            prompt_text = (
                f"{rule}\n\n"
                "Carefully analyze the provided image and write a creative, engaging caption based on what you see. "
                "Describe the scene, mood, and key elements naturally in the caption."
            )
        else:
            prompt_text = rule

        user_content = [{"type": "text", "text": prompt_text}]

        if image_path:
            if topic:
                user_content[0]["text"] += (
                    "\n\nAnalyze the provided image and include details from it in the caption "
                    "to make it more relevant and authentic."
                )

            base64_image = self._encode_image(image_path)
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}"
                },
            })

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                max_tokens=500,
            )

            result = response.choices[0].message.content.strip()

            if (result.startswith('"') and result.endswith('"')) or (
                result.startswith("'") and result.endswith("'")
            ):
                result = result[1:-1].strip()

            hashtags = re.findall(r"#\w+", result)
            caption = re.split(r"\n\s*#", result)[0].strip()

            return {
                "caption": caption,
                "hashtags": hashtags,
                "full_caption": result,
                "platform": platform,
            }

        except Exception as e:
            raise self._wrap_openai_error(e, "caption")

    async def generate_multi_captions(
        self,
        topic: Optional[str] = None,
        image_path: Optional[str] = None,
    ) -> Dict:
        if not self.client:
            raise CaptionGenerationError(
                "OpenAI API key is missing. Add OPENAI_API_KEY to your .env file and restart the server.",
                status_code=503,
            )

        system_prompt = (
            "You are a social media expert. Write high-quality, engaging captions for multiple platforms.\n"
            "You MUST return valid JSON with keys: instagram, linkedin, and threads.\n\n"
            "Rules:\n"
            "- instagram: Fun, engaging, emojis, exactly 5 hashtags.\n"
            "- linkedin: Professional, viral-style structure with hook, 2-3 short paragraphs, CTA, and 4-5 hashtags.\n"
            "- threads: Short, punchy, conversational, and direct. Emojis welcome, limit hashtags to 0 or 1 relevant hashtags."
        )

        prompt_text = "Generate captions for all platforms."

        if topic:
            prompt_text += f"\n\nTopic/Context: {topic}"
        elif image_path:
            prompt_text += "\n\nAnalyze the provided image and generate creative captions based on its visual elements."

        user_content = [{"type": "text", "text": prompt_text}]

        if image_path:
            base64_image = self._encode_image(image_path)
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}"
                },
            })

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                max_tokens=1000,
            )

            result = json.loads(response.choices[0].message.content)

            return {
                "instagram": result.get("instagram", ""),
                "linkedin": result.get("linkedin", ""),
                "threads": result.get("threads", ""),
            }

        except Exception as e:
            raise self._wrap_openai_error(e, "multi-platform captions")

    def _wrap_openai_error(self, error: Exception, context: str) -> CaptionGenerationError:
        logger.error("OpenAI %s error: %s", context, error)

        if isinstance(error, AuthenticationError):
            return CaptionGenerationError(
                "OpenAI API key is invalid or expired. Update OPENAI_API_KEY in .env and restart the server.",
                status_code=401,
            )

        if isinstance(error, RateLimitError):
            return CaptionGenerationError(
                "OpenAI rate limit reached. Wait a moment and try again.",
                status_code=429,
            )

        if isinstance(error, APIConnectionError):
            return CaptionGenerationError(
                "Could not reach OpenAI. Check your internet connection and try again.",
                status_code=503,
            )

        return CaptionGenerationError(
            f"Failed to generate {context}. Please try again.",
            status_code=500,
        )


openai_service = OpenAICaptionService()