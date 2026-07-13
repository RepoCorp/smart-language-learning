from __future__ import annotations

from .management import APIView, Request, Response, _normalized_pair, _parse_item_conversation_history, status
from .topic_conversation_models import evaluate_goal_achievement as evaluate_goal_achievement_with_question_model


class ContentTopicConversationGoalEvaluationView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        goal_text = str(request.data.get("goal_text", "")).strip()
        latest_user_text = str(request.data.get("latest_user_text", "")).strip()
        if not topic:
            return Response({"detail": "topic is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not goal_text:
            return Response({"detail": "goal_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not latest_user_text:
            return Response({"detail": "latest_user_text is required"}, status=status.HTTP_400_BAD_REQUEST)

        history = _parse_item_conversation_history(request.data.get("history"))
        try:
            goal_achieved, goal_achievement_message, next_goal_suggestion = evaluate_goal_achievement_with_question_model(
                topic=topic,
                notes=notes,
                role_text=role_text,
                goal_text=goal_text,
                history=history,
                latest_user_text=latest_user_text,
                source_language=source_language,
                target_language=target_language,
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(
            {
                "goal_achieved": goal_achieved,
                "goal_achievement_message": goal_achievement_message,
                "next_goal_suggestion": next_goal_suggestion,
            }
        )
