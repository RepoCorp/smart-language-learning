from __future__ import annotations

from .management import APIView, Request, Response, status
from ...auth import get_request_user
from .management_topic_conversation_goal_generation import generate_conversation_goal
from .management_topic_conversation_shared import validate_conversation_start_fields, validate_conversation_start_payload
from .topic_pool import resolve_topic_choice


class ContentTopicConversationGoalEvaluationView(APIView):
    def post(self, request: Request) -> Response:
        # Older clients may still call this endpoint; never charge for a retired feature.
        return Response(
            {"detail": "Goal evaluation has been removed. Goals are conversation guides only."},
            status=status.HTTP_410_GONE,
        )


class ContentTopicConversationGoalRegenerateView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language, topic, notes, role_text, goal_difficulty = validate_conversation_start_fields(request)
        topic = resolve_topic_choice(
            user=get_request_user(request),
            topic=topic,
            source_language=source_language,
            target_language=target_language,
        )
        validation_error = validate_conversation_start_payload(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_difficulty=goal_difficulty,
        )
        if validation_error is not None:
            return validation_error
        try:
            goal_text, selected_difficulty = generate_conversation_goal(
                topic=topic,
                notes=notes,
                role_text=role_text,
                goal_difficulty=goal_difficulty,
                source_language=source_language,
                target_language=target_language,
            )
        except RuntimeError:
            return Response(
                {"detail": "Could not create a conversation goal. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"topic": topic, "goal_text": goal_text, "goal_difficulty": selected_difficulty})
