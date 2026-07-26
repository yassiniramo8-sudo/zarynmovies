import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileContentLists } from "@/components/profile/ProfileContentLists";
import { NotificationPanel } from "@/components/profile/NotificationPanel";

const ProfilePage = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  if (!user || !profile) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-muted-foreground">{t("profile.signInRequired")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-12">
      <div className="container mx-auto max-w-4xl space-y-8">
        <ProfileHeader />
        <NotificationPanel />
        <ProfileContentLists />
      </div>
    </div>
  );
};

export default ProfilePage;
