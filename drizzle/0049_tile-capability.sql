ALTER TABLE `users` ADD `can_edit_tiles` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- The legacy GLOBAL editor (role 'editor' + scope 'all') meant "moderator surfaces plus tile
-- authoring on every event". That's exactly a moderator holding the new capability, so convert it
-- and stop having two ways to describe the same person.
--
-- BOARD-SCOPED editors (scope 'assigned') are deliberately left alone: that role is an internal
-- marker maintained by lib/eventEditors for "a member who holds board grants", not something an
-- admin picks, and their access still comes from the event_editors rows themselves.
UPDATE `users` SET `role` = 'moderator', `can_edit_tiles` = 1
  WHERE `role` = 'editor' AND `editor_scope` = 'all';
