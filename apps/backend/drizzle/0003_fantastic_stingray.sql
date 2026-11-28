CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"awarded_by" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "point_transactions_group_student_idx" ON "point_transactions" USING btree ("group_id","student_id");--> statement-breakpoint
CREATE INDEX "point_transactions_group_created_at_idx" ON "point_transactions" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "point_transactions_student_id_idx" ON "point_transactions" USING btree ("student_id");