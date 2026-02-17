"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FolderOpen, Lightbulb } from "lucide-react";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { NotificationSettings } from "./notification-settings";
import { useLocale } from "@/lib/use-locale";
import { statusBadgeClass, statusLabel } from "@/lib/status-utils";

const DEFAULT_VISIBLE = 5;

interface ProfileProject {
  id: string;
  title: string;
  status: string;
}

interface ProfileProposal {
  id: string;
  title: string;
  projectId: string;
}

interface ProfileTabsProps {
  user: {
    email: string;
    role: string;
    memberSince: string;
    displayName: string;
    firstName: string;
    lastName: string;
    hasPassword: boolean;
  };
  projects: ProfileProject[];
  proposals: ProfileProposal[];
  notificationPrefs: {
    emailNewProposal: boolean;
    emailVoteOnMine: boolean;
    emailCommentReply: boolean;
  };
}

function CollapsibleList<T extends { id: string }>({
  items,
  renderItem,
  emptyIcon,
  emptyText,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyIcon: React.ReactNode;
  emptyText: string;
}) {
  const { t } = useLocale();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, DEFAULT_VISIBLE);
  const hasMore = items.length > DEFAULT_VISIBLE;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="rounded-full bg-muted p-3">{emptyIcon}</div>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {visible.map((item) => (
          <li key={item.id}>{renderItem(item)}</li>
        ))}
      </ul>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? t("profile.showLess") : t("profile.showMore")}
        </Button>
      )}
    </div>
  );
}

function getInitials(firstName: string, lastName: string, email: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  return email[0].toUpperCase();
}

export function ProfileTabs({ user, projects, proposals, notificationPrefs }: ProfileTabsProps) {
  const { t } = useLocale();

  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="account">{t("profile.tabAccount")}</TabsTrigger>
        <TabsTrigger value="security">{t("profile.tabSecurity")}</TabsTrigger>
        <TabsTrigger value="notifications">{t("profile.tabNotifications")}</TabsTrigger>
        <TabsTrigger value="projects">{t("profile.tabProjects")}</TabsTrigger>
        <TabsTrigger value="proposals">{t("profile.tabProposals")}</TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {getInitials(user.firstName, user.lastName, user.email)}
              </div>
              <div>
                <CardTitle>{t("profile.account")}</CardTitle>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.email")}</p>
                <p>{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.role")}</p>
                <p className="capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.memberSince")}</p>
                <p>{user.memberSince}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("profile.displayName")}</p>
                <p>{user.displayName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileForm firstName={user.firstName} lastName={user.lastName} />
      </TabsContent>

      <TabsContent value="security">
        {user.hasPassword ? (
          <ChangePasswordForm />
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("profile.noPasswordSet")}</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="notifications">
        <NotificationSettings prefs={notificationPrefs} />
      </TabsContent>

      <TabsContent value="projects">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.yourProjects", { count: projects.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <CollapsibleList
              items={projects}
              emptyIcon={<FolderOpen className="h-5 w-5 text-muted-foreground" />}
              emptyText={t("profile.noProjects")}
              renderItem={(p) => (
                <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                  <Link
                    href={`/projects/${p.id}`}
                    className="truncate text-sm font-medium text-primary hover:underline"
                    title={p.title}
                  >
                    {p.title}
                  </Link>
                  <Badge className={`shrink-0 ${statusBadgeClass(p.status)}`}>
                    {statusLabel(p.status, t)}
                  </Badge>
                </div>
              )}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="proposals">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.yourProposals", { count: proposals.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <CollapsibleList
              items={proposals}
              emptyIcon={<Lightbulb className="h-5 w-5 text-muted-foreground" />}
              emptyText={t("profile.noProposals")}
              renderItem={(p) => (
                <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                  <Link
                    href={`/projects/${p.projectId}`}
                    className="text-sm font-medium text-primary hover:underline"
                    title={p.title}
                  >
                    {p.title}
                  </Link>
                </div>
              )}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
