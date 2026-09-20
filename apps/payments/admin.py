from django.contrib import admin

from .models import Notification, Settlement


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ("id", "tour", "payer", "payee", "amount", "method", "status", "created_at")
    list_filter = ("method", "status")
    search_fields = ("payer__email", "payee__email", "tour__title")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient", "notif_type", "is_read", "created_at")
    list_filter = ("notif_type", "is_read")
    search_fields = ("recipient__email", "message")
