from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("learning", "0014_item_exercise_phrases"),
    ]

    operations = [
        migrations.CreateModel(
            name="ItemQuestionExchange",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "source_language",
                    models.CharField(
                        choices=[
                            ("spanish", "Spanish"),
                            ("english", "English"),
                            ("german", "German"),
                            ("french", "French"),
                            ("italian", "Italian"),
                            ("portuguese", "Portuguese"),
                        ],
                        default="spanish",
                        max_length=20,
                    ),
                ),
                (
                    "target_language",
                    models.CharField(
                        choices=[
                            ("spanish", "Spanish"),
                            ("english", "English"),
                            ("german", "German"),
                            ("french", "French"),
                            ("italian", "Italian"),
                            ("portuguese", "Portuguese"),
                        ],
                        default="german",
                        max_length=20,
                    ),
                ),
                (
                    "question_type",
                    models.CharField(
                        choices=[
                            ("grammar_explanation", "Grammar explanation"),
                            ("more_examples", "More examples"),
                            ("common_mistakes", "Common mistakes"),
                        ],
                        max_length=40,
                    ),
                ),
                ("question_text", models.CharField(max_length=255)),
                ("answer_text", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="question_exchanges",
                        to="learning.item",
                    ),
                ),
            ],
            options={
                "ordering": ("created_at", "id"),
            },
        ),
        migrations.AddIndex(
            model_name="itemquestionexchange",
            index=models.Index(fields=["item", "created_at"], name="lrn_iq_item_created_idx"),
        ),
    ]
