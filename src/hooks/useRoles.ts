import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchRolesAndPermissions = async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("admin_permissions").select("permission").eq("user_id", user.id),
      ]);

      setRoles((rolesRes.data || []).map((r: any) => r.role));
      setPermissions((permsRes.data || []).map((p: any) => p.permission));
      setLoading(false);
    };

    fetchRolesAndPermissions();
  }, [user]);

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;
  const isModerator = roles.includes("moderator") || isAdmin;

  const hasPermission = (perm: string) => isSuperAdmin || permissions.includes(perm);

  return { roles, permissions, loading, isSuperAdmin, isAdmin, isModerator, hasPermission };
}
