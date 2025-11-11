    -- Add delete policy for notifications
    -- Users can delete messages they received

    drop policy if exists notif_delete on public.notifications;
    create policy notif_delete on public.notifications
    for delete using (
    recipient_id = auth.uid()
    );
