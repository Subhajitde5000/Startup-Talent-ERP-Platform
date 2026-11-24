"""Small approved screening catalogue, not a discriminatory free-text question builder."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ScreeningKey = Literal[
    "notice_period", "remote_comfort", "relevant_experience", "work_authorization"
]
CATALOGUE = {
    "notice_period": (
        "What is your notice period?",
        "choice",
        ["immediate", "30_days", "60_days", "90_days"],
    ),
    "remote_comfort": ("Are you comfortable working remotely?", "boolean", []),
    "relevant_experience": ("Describe your experience relevant to this role.", "text", []),
    "work_authorization": ("Are you authorized to work in the job location?", "boolean", []),
}


class ScreeningQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: ScreeningKey
    required: bool = Field(default=False, strict=True)


class ScreeningQuestionRead(ScreeningQuestion):
    prompt: str
    type: str
    options: list[str]


def questions(config: list[dict]) -> list[ScreeningQuestionRead]:
    return [
        ScreeningQuestionRead(
            **q,
            prompt=CATALOGUE[q["key"]][0],
            type=CATALOGUE[q["key"]][1],
            options=CATALOGUE[q["key"]][2],
        )
        for q in config
    ]
