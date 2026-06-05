from __future__ import annotations

from .management import (
    APIView,
    Item,
    ItemQuestionExchange,
    Request,
    Response,
    _item_question_history,
    _model_answer_or_reject_item_question,
    _normalized_pair,
    _serialize_question_exchange,
    apply_user_scope,
    get_request_user,
    logger,
    status,
)


class ContentItemQuestionView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        question_text = str(request.data.get("question_text", "")).strip()
        logger.info(
            "content.item_question.received item_id=%s source_lang=%s target_lang=%s question=%r",
            item_id,
            source_language,
            target_language,
            question_text[:255],
        )
        if not question_text:
            logger.info("content.item_question.rejected item_id=%s code=EMPTY_QUESTION", item_id)
            return Response({"detail": "question_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(question_text) > 255:
            logger.info("content.item_question.rejected item_id=%s code=QUESTION_TOO_LONG len=%s", item_id, len(question_text))
            return Response({"detail": "question_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decision = _model_answer_or_reject_item_question(
                item=item,
                question_text=question_text,
                source_language=source_language,
                target_language=target_language,
                conversation_history=request.data.get("conversation_history"),
            )
        except RuntimeError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not decision["related"]:
            logger.info(
                "content.item_question.rejected item_id=%s code=%s reason=%r question=%r",
                item_id,
                decision["code"],
                decision.get("reason", ""),
                question_text[:255],
            )
            return Response(
                {
                    "detail": "Question must be related to learning this specific item.",
                    "code": decision["code"],
                    "reason": decision.get("reason", ""),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        answer_text = decision["answer"]
        logger.info(
            "content.item_question.accepted item_id=%s code=%s answer_len=%s",
            item_id,
            decision["code"],
            len(answer_text),
        )
        exchange = ItemQuestionExchange.objects.create(
            item=item,
            source_language=source_language,
            target_language=target_language,
            question_type=ItemQuestionExchange.QuestionType.CUSTOM_RELATED,
            question_text=question_text,
            answer_text=answer_text,
        )
        conversation = _item_question_history(item)
        return Response(
            {
                "exchange": _serialize_question_exchange(exchange),
                "conversation": conversation,
            },
            status=status.HTTP_201_CREATED,
        )
