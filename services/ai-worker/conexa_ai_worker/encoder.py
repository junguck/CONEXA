"""Deterministic encoding of dating questionnaire answers (ADR 0003).

Answers are closed-catalogue option ids or 1-5 scale values. Free text is not
accepted: user text must never be interpreted, only hashed identifiers are used.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Any, Mapping

BLOCKS = ("values", "personality", "lifestyle")
DIMENSION = 64
MODEL_VERSION = "dating-qhash-v1"
_SCALE_LEVELS = (1, 2, 3, 4, 5)
_MAX_QUESTION_ID_LENGTH = 64
_MAX_ANSWER_TOKEN_LENGTH = 64
_MAX_QUESTIONS_PER_BLOCK = 40
_ANSWER_SEPARATOR = "|"
_IDENTIFIER = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


class InvalidAnswers(ValueError):
    """Raised when the answer payload cannot be encoded deterministically."""


def encode_profile(answers: Mapping[str, Any]) -> dict[str, list[float]]:
    """Encode answers grouped by block into three L2-normalised vectors."""
    if not isinstance(answers, Mapping):
        raise InvalidAnswers("answers must be an object grouped by block")
    unknown = set(answers) - set(BLOCKS)
    if unknown:
        raise InvalidAnswers(f"unknown answer blocks: {sorted(unknown)}")
    return {block: _encode_block(block, answers.get(block, {})) for block in BLOCKS}


def _encode_block(block: str, answers: Any) -> list[float]:
    if not isinstance(answers, Mapping):
        raise InvalidAnswers(f"block {block} must be an object of answers")
    if len(answers) > _MAX_QUESTIONS_PER_BLOCK:
        raise InvalidAnswers(f"block {block} has too many answers")

    vector = [0.0] * DIMENSION
    for question_id, answer in answers.items():
        question = _validated_question_id(question_id)
        for token, weight in _answer_tokens(question, answer):
            for index, value in enumerate(_token_vector(token)):
                vector[index] += weight * value
    return _normalise(vector)


def _validated_question_id(question_id: Any) -> str:
    if not isinstance(question_id, str) or not question_id:
        raise InvalidAnswers("question ids must be non-empty strings")
    if len(question_id) > _MAX_QUESTION_ID_LENGTH:
        raise InvalidAnswers("question id is too long")
    if not _IDENTIFIER.match(question_id):
        raise InvalidAnswers("question ids must be lowercase identifiers")
    return question_id


def _answer_tokens(question: str, answer: Any) -> list[tuple[str, float]]:
    if isinstance(answer, bool):
        raise InvalidAnswers("boolean answers are not supported")
    if isinstance(answer, str):
        return [(f"{question}{_ANSWER_SEPARATOR}{_validated_option(answer)}", 1.0)]
    if isinstance(answer, int):
        if answer not in _SCALE_LEVELS:
            raise InvalidAnswers("scale answers must be integers from 1 to 5")
        return [
            (f"{question}{_ANSWER_SEPARATOR}scale={level}", _scale_weight(answer, level))
            for level in _SCALE_LEVELS
        ]
    if isinstance(answer, (list, tuple)):
        if not answer:
            raise InvalidAnswers("multiple-choice answers must not be empty")
        return [
            (f"{question}{_ANSWER_SEPARATOR}{_validated_option(option)}", 1.0)
            for option in answer
        ]
    raise InvalidAnswers(f"unsupported answer type: {type(answer).__name__}")


def _validated_option(option: Any) -> str:
    if not isinstance(option, str) or not option:
        raise InvalidAnswers("options must be non-empty strings")
    if len(option) > _MAX_ANSWER_TOKEN_LENGTH:
        raise InvalidAnswers("option is too long")
    if not _IDENTIFIER.match(option):
        raise InvalidAnswers("options must be lowercase identifiers, never free text")
    return option


def _scale_weight(value: int, level: int) -> float:
    return max(0.0, 1.0 - abs(value - level) / 2.0)


def _token_vector(token: str) -> list[float]:
    """Expand a token into a stable pseudo-random 64-dimension vector."""
    seed = hashlib.sha256(f"{MODEL_VERSION}|{token}".encode("utf-8")).digest()
    values: list[float] = []
    counter = 0
    while len(values) < DIMENSION:
        chunk = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        values.extend((byte / 127.5) - 1.0 for byte in chunk)
        counter += 1
    return values[:DIMENSION]


def _normalise(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        return [0.0] * DIMENSION
    return [round(value / norm, 9) for value in vector]
