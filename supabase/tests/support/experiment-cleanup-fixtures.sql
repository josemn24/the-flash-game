-- Upgrade-only fixtures: populate every retired table before testing their removal.
insert into public.rooms(id,slug,title) values(test_support.id('blocked-room'),'blocked-room','Pending study');
insert into public.room_memberships(room_id,player_id,role) values(test_support.id('blocked-room'),test_support.id('member'),'owner');
insert into public.seasons(id,room_id,title,status,starts_at,ends_at)
values(test_support.id('blocked-season'),test_support.id('blocked-room'),'Pending season','draft',now(),now()+interval '1 day');
insert into private.product_experiments(id,room_id,season_id)
values(test_support.id('legacy-study'),test_support.id('blocked-room'),test_support.id('blocked-season'));
insert into private.product_experiment_publications(experiment_id,publication_id,position,challenge_version_id,opens_at,closes_at,mode)
select test_support.id('legacy-study'),id,1,challenge_version_id,opens_at,closes_at,'flash'
from public.scheduled_challenges where id=test_support.id('sc-flash');
insert into private.product_experiment_participants(experiment_id,code,player_id)
values(test_support.id('legacy-study'),'P01',test_support.id('member'));
insert into private.product_events(event_id,experiment_id,participant_code,type,visit_id,occurred_at,app_version)
values(test_support.id('legacy-event'),test_support.id('legacy-study'),'P01','room_viewed',test_support.id('legacy-visit'),now(),'old');
insert into private.product_ratings(id,experiment_id,participant_code,publication_id,value)
values(test_support.id('legacy-rating'),test_support.id('legacy-study'),'P01',test_support.id('sc-flash'),2);
insert into private.product_experiment_journal(experiment_id,kind,note,occurred_at)
values(test_support.id('legacy-study'),'incident','Obsolete synthetic incident',now());
insert into private.product_measurement_snapshots(experiment_id,kind,revision,cutoff,report,sources)
values(test_support.id('legacy-study'),'primary',1,now(),'{}','{}');
insert into private.product_measurement_commands(experiment_id,key,actor_id,input,result)
values(test_support.id('legacy-study'),'old-command',test_support.id('superadmin'),'{}','{}');
select test_support.must_fail('update public.seasons set status=''active'' where id=test_support.id(''blocked-season'')','55000');
