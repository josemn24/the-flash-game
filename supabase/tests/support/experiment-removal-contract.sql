-- Negative contract: obsolete objects and writes must not survive installation or upgrade.
do $$begin
 assert not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname=any(array['product_experiments','product_experiment_publications','product_experiment_participants','product_events','product_ratings','product_experiment_journal','product_measurement_snapshots','product_measurement_commands'])), 'No experimental tables remain';
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('private','public') and p.proname=any(array['manage_product_experiment','record_product_event','read_my_product_rating','save_my_product_rating','get_my_product_instruments','purge_product_measurements','get_superadmin_product_experiments','get_superadmin_product_experiment','get_superadmin_product_experiment_header','get_superadmin_product_records','get_superadmin_product_snapshot','guard_product_experiment_launch','audit_product_publication_change','validate_experiment_definition','tabarnia_experiment_definition','guard_experiment_definition','set_product_publication_scope','start_superadmin_room_measurement','get_superadmin_room_measurement'])), 'No experimental or manual-start functions remain';
 assert not exists(select 1 from pg_trigger where not tgisinternal and tgname=any(array['guard_product_experiment_launch','audit_product_publication_change','guard_experiment_definition','set_product_publication_scope'])), 'No experimental triggers remain';
 assert not exists(select 1 from pg_attribute where attrelid='private.room_measurements'::regclass and attname='created_by_player_id' and not attisdropped), 'Manual creator metadata is removed';
end $$;
select 'experiment_removal_contract_ok';
