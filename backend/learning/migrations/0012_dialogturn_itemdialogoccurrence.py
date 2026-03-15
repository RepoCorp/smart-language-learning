from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0011_saveddialog"),
    ]

    operations = [
        migrations.CreateModel(
            name="DialogTurn",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("turn_index", models.PositiveIntegerField()),
                ("source_text", models.TextField(blank=True)),
                ("target_text", models.TextField(blank=True)),
                (
                    "dialog",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dialog_turns",
                        to="learning.saveddialog",
                    ),
                ),
            ],
            options={"ordering": ("turn_index", "id")},
        ),
        migrations.CreateModel(
            name="ItemDialogOccurrence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("turn_index", models.PositiveIntegerField()),
                ("side", models.CharField(choices=[("source", "Source"), ("target", "Target")], max_length=10)),
                ("match_score", models.FloatField(default=0.0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "dialog",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_occurrences",
                        to="learning.saveddialog",
                    ),
                ),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dialog_occurrences",
                        to="learning.item",
                    ),
                ),
                (
                    "turn",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="item_occurrences",
                        to="learning.dialogturn",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="dialogturn",
            constraint=models.UniqueConstraint(
                fields=("dialog", "turn_index"),
                name="lrn_dturn_dialog_turn_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="itemdialogoccurrence",
            constraint=models.UniqueConstraint(
                fields=("item", "dialog", "turn_index", "side"),
                name="lrn_iocc_item_dlg_turn_side_uq",
            ),
        ),
        migrations.AddIndex(
            model_name="itemdialogoccurrence",
            index=models.Index(fields=["item", "created_at"], name="lrn_iocc_item_created_idx"),
        ),
        migrations.AddIndex(
            model_name="itemdialogoccurrence",
            index=models.Index(fields=["dialog"], name="lrn_iocc_dialog_idx"),
        ),
    ]
