from django.db.models.signals import post_save
from django.dispatch import receiver

from .grammar_features import sync_item_grammar_features
from .models import Item


@receiver(post_save, sender=Item)
def synchronize_item_grammar_features(sender, instance: Item, raw: bool, **kwargs) -> None:
    if not raw:
        sync_item_grammar_features(instance)
