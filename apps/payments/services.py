"""
Shared balance math for a tour: who has paid what, what everyone's share
is, and the smallest set of payments that would settle everyone up.

Used by the settlement report (this app) and by apps.reports, so the two
never disagree with each other.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum

from apps.expenses.models import Expense

from .models import Settlement


def money(value):
    return Decimal(value or 0).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_tour_balances(tour):
    """
    Returns (member_users, share_per_member, balances) where balances is a
    dict of user_id -> {"user": User, "paid": Decimal, "share": Decimal,
    "settled_out": Decimal, "settled_in": Decimal, "balance": Decimal}.

    "balance" already accounts for approved/paid settlements, so once a
    debt has actually been settled it drops out of future suggestions.
    """

    expenses = Expense.objects.filter(tour=tour).select_related("paid_by")

    total_expense = money(expenses.aggregate(total=Sum("amount"))["total"] or 0)

    member_users = {tour.created_by}
    for membership in tour.members.select_related("user"):
        member_users.add(membership.user)

    member_count = len(member_users) or 1
    share_per_member = money(total_expense / member_count)

    paid_by_user = {}
    for expense in expenses:
        paid_by_user[expense.paid_by_id] = paid_by_user.get(
            expense.paid_by_id, Decimal("0")
        ) + expense.amount

    # Money that has already changed hands directly between members
    # (approved cash settlements, paid card settlements) shifts the
    # balance too: the payer effectively "paid" that much more of their
    # share, and the payee has already "received" that much of what
    # they're owed.
    settled_out = {}
    settled_in = {}
    for settlement in Settlement.objects.filter(
        tour=tour, status__in=Settlement.SETTLED_STATUSES
    ):
        settled_out[settlement.payer_id] = settled_out.get(
            settlement.payer_id, Decimal("0")
        ) + settlement.amount
        settled_in[settlement.payee_id] = settled_in.get(
            settlement.payee_id, Decimal("0")
        ) + settlement.amount

    balances = {}
    for user in member_users:
        paid = money(paid_by_user.get(user.id, 0))
        out = money(settled_out.get(user.id, 0))
        received = money(settled_in.get(user.id, 0))
        balance = money(paid + out - received - share_per_member)

        balances[user.id] = {
            "user": user,
            "paid": paid,
            "share": share_per_member,
            "settled_out": out,
            "settled_in": received,
            "balance": balance,
        }

    return member_users, share_per_member, balances, total_expense


def compute_settlement_suggestions(tour):
    """
    Greedily pairs off people who owe money with people who are owed
    money, so the group can settle up with the fewest possible payments.
    Returns a list of {"from_user", "to_user", "amount"} dicts.
    """

    _, _, balances, _ = compute_tour_balances(tour)

    debtors = []
    creditors = []

    for entry in balances.values():
        balance = entry["balance"]
        if balance < Decimal("-0.005"):
            debtors.append([entry["user"], -balance])
        elif balance > Decimal("0.005"):
            creditors.append([entry["user"], balance])

    debtors.sort(key=lambda item: item[1], reverse=True)
    creditors.sort(key=lambda item: item[1], reverse=True)

    suggestions = []
    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):

        debtor, owed = debtors[i]
        creditor, due = creditors[j]

        settle_amount = money(min(owed, due))

        if settle_amount > 0:
            suggestions.append({
                "from_user": debtor,
                "to_user": creditor,
                "amount": settle_amount,
            })

        debtors[i][1] = owed - settle_amount
        creditors[j][1] = due - settle_amount

        if debtors[i][1] <= Decimal("0.005"):
            i += 1
        if creditors[j][1] <= Decimal("0.005"):
            j += 1

    return suggestions
