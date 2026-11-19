"""The organization permission matrix — ONE source of truth (Step 3d item 7).

The team page renders a static "Roles at a glance" card and a "Permissions
at a glance" modal. If that text is hand-written in the page while the
rules live in ``organization_service``, the two drift the first time a rule
changes. This module holds the matrix once:

- ``TEAM_ACTIONS`` maps each management action to the org roles allowed to
  perform it. ``organization_service`` imports its role set from here
  instead of re-declaring ``{owner, admin}``, so the check and the served
  matrix cannot disagree.
- ``GET /organizations/permissions`` serves it, and the page renders what
  the API says.

Scope note: this covers *team management* (this step). Read-only workspace
actions (tasks, readiness, stage tools) use ``member``/``viewer`` splits
declared in their own services; they are not duplicated here.
"""

from app.models.organization import OrgRole

# Roles that may manage the team at all (invite, change, deactivate,
# remove, export). Replaces the previous ``write=True`` shorthand.
TEAM_MANAGERS: frozenset[OrgRole] = frozenset({OrgRole.owner, OrgRole.admin})

# Roles that may read the team directory, the drawer, and the summary
# card. Every active member, including viewers (read-only).
TEAM_READERS: frozenset[OrgRole] = frozenset(
    {OrgRole.owner, OrgRole.admin, OrgRole.member, OrgRole.viewer}
)


class TeamAction:
    """One row of the matrix: a named capability and the roles holding it."""

    __slots__ = ("key", "label", "roles", "owner_only")

    def __init__(
        self,
        key: str,
        label: str,
        roles: frozenset[OrgRole],
        *,
        owner_only: bool = False,
    ) -> None:
        self.key = key
        self.label = label
        self.roles = roles
        self.owner_only = owner_only


TEAM_ACTIONS: tuple[TeamAction, ...] = (
    TeamAction("view_team", "View the team directory and summary", TEAM_READERS),
    TeamAction(
        "manage_members",
        "Invite, change access, deactivate, reactivate and remove members",
        TEAM_MANAGERS,
    ),
    TeamAction("manage_invites", "Resend and revoke pending invites", TEAM_MANAGERS),
    TeamAction("export_team", "Export the team list as CSV", TEAM_MANAGERS),
    # Ownership moves only through the dedicated transfer endpoint, which
    # demotes the outgoing owner to admin in the same transaction.
    TeamAction(
        "transfer_ownership",
        "Transfer ownership to another member",
        frozenset({OrgRole.owner}),
        owner_only=True,
    ),
)

# Extra rules that are not "which roles" but "which targets" — served so the
# page can explain a disabled control instead of silently hiding it.
TEAM_RULES: tuple[str, ...] = (
    "Only an owner can assign or transfer ownership.",
    "An admin cannot change, deactivate or remove an owner.",
    "The last active owner can never be deactivated, removed or demoted.",
    "A deactivated member loses access immediately and keeps their history.",
    "Nobody can deactivate or remove themselves.",
    "Removing a member unassigns their open tasks; comments and history stay.",
)


def actions_for(role: OrgRole) -> dict[str, bool]:
    """The capability map for one caller's role."""
    return {action.key: role in action.roles for action in TEAM_ACTIONS}


def permission_matrix() -> dict:
    """The full matrix, as served by GET /organizations/permissions."""
    return {
        "roles": [role.value for role in OrgRole],
        "actions": [
            {
                "key": action.key,
                "label": action.label,
                "roles": [role.value for role in OrgRole if role in action.roles],
                "owner_only": action.owner_only,
            }
            for action in TEAM_ACTIONS
        ],
        "rules": list(TEAM_RULES),
    }
