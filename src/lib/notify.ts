import type { SupabaseClient } from "@supabase/supabase-js";

export interface GroupNotification {
  id: string;
  group_id: string;
  actor_user_id: string | null;
  actor_name: string;
  action_type: string;
  message: string;
  created_at: string;
}

export async function logGroupNotification(
  supabase: SupabaseClient,
  params: {
    groupId: string;
    actorUserId: string;
    actorName: string;
    actionType: string;
    message: string;
  }
) {
  await supabase.from("group_notifications").insert({
    group_id: params.groupId,
    actor_user_id: params.actorUserId,
    actor_name: params.actorName,
    action_type: params.actionType,
    message: params.message,
  });
}
