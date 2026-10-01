-- MeritLaunch test-profile loader (generated 2026-08-28 from test_profiles_seed.json)
-- Target: Supabase project zudczsepvkjbjgomgilz, table public.user_profiles
--
-- IMPORTANT: user_profiles.id = auth.users.id (the handle_new_user trigger creates the
-- row at signup). So FIRST sign up each test account in the app UI with the emails
-- below, THEN run this script in the Supabase SQL editor. It matches on auth.users.email
-- and upserts the denormalized columns + the full profile_data jsonb, exactly like
-- saveProfileToSupabase() in src/App.jsx. grade_level and leadership stay NULL because
-- the app maps them from fields the form never collects.
--
-- Accounts to create first:
--   coreyskinner+ml-jenna@gmail.com  (Jenna Ostercamp)
--   coreyskinner+ml-amara@gmail.com  (Amara Boyd)
--   coreyskinner+ml-daniel@gmail.com  (Daniel Yoon)
--   coreyskinner+ml-mateo@gmail.com  (Mateo Ávila)
--   coreyskinner+ml-nora@gmail.com  (Nora Whitfield)

-- ============ Jenna Ostercamp (test-jenna-firstgen-rural-stem) ============
INSERT INTO public.user_profiles
  (id, name, gpa, grade_level, intended_major, heritage, citizenship, financial_need, activities, leadership, profile_data, updated_at)
SELECT u.id,
  'Jenna Ostercamp',
  '3.98',
  NULL,
  'Agricultural Engineering',
  'White/Caucasian',
  'U.S. Citizen',
  'Yes — Pell-eligible',
  'Captain, FTC robotics team (grades 10-12; we build in Mr. Loger''s shop after chores). Vice President, Hartley-Melvin-Sanborn FFA chapter (senior year; ran the fruit sale, $11,400 raised, chapter record). 4-H, Clay County, 10 years (bucket calves, then ag mechanics projects). National Honor Society. Work: Van''s Feed & Seed, about 15 hours a week since sophomore year (loading, inventory, small-engine repair when Van lets me). Detasseling crew, summers 2024 and 2025. Weeknights I watch my brother Tyler, who is 11, until Mom gets home from her second job.',
  NULL,
  $profile_json${
  "name": "Jenna Ostercamp",
  "email": "coreyskinner+ml-jenna@gmail.com",
  "phone": "(712) 555-0147",
  "location": "Hartley, IA",
  "citizenship": "U.S. Citizen",
  "ethnicity": [
    "White/Caucasian"
  ],
  "gpa": "3.98",
  "satact": "1290 SAT",
  "school": "Hartley-Melvin-Sanborn High School",
  "gradYear": "2027",
  "intendedMajor": "Agricultural Engineering",
  "financialNeed": "Yes — Pell-eligible",
  "activities": "Captain, FTC robotics team (grades 10-12; we build in Mr. Loger's shop after chores). Vice President, Hartley-Melvin-Sanborn FFA chapter (senior year; ran the fruit sale, $11,400 raised, chapter record). 4-H, Clay County, 10 years (bucket calves, then ag mechanics projects). National Honor Society. Work: Van's Feed & Seed, about 15 hours a week since sophomore year (loading, inventory, small-engine repair when Van lets me). Detasseling crew, summers 2024 and 2025. Weeknights I watch my brother Tyler, who is 11, until Mom gets home from her second job.",
  "awards": "2nd in my class of 91 (school does not weight GPAs). FFA Iowa Degree, 2026. Grand Champion, Clay County Fair ag mechanics project, 2025 (rebuilt a 1968 Feterl grain auger for $212 in parts, kept every receipt). 3rd place team, Iowa FFA Agricultural Technology & Mechanical Systems CDE. Academic All-Conference, three years. National Honor Society.",
  "communityService": "Every April our FFA chapter runs Farm Safety Day for the elementary school. I have helped run it for three years and I was in charge of it this year. About 120 kids come through six stations in one morning. My station is the PTO demonstration, where we use a dummy in a loose jacket and a spinning shaft to show what a power takeoff does to fabric. It is loud and a little scary and that is the point. Kids around here climb on equipment all the time, and every farmer knows somebody who is missing fingers or worse. Last year a second grader asked me if the dummy had a name, so now he does. His name is Carl, and Carl has lost his jacket in front of maybe 250 kids by now.\n\nI also do the boring part, which is calling implement dealers in January to borrow equipment and getting the insurance forms signed. Probably 40 hours a year all together. It is not glamorous service. Nobody cries at the end. But if one kid stays off a moving hay wagon because of Carl, that is worth more than any canned food drive I could have run instead.",
  "personalStory": "My mom runs the scale house at the co-op during the day and stocks shelves at the Fareway in Spencer at night, and for most of my life the plan was that I would graduate and get a job with benefits as fast as possible. Nobody in my family has a four-year degree. My uncle went to Iowa Lakes for diesel tech and that was the ceiling, as far as anyone knew.\n\nWhat changed it was a broken auger. October of my sophomore year, harvest, and I was riding along with my neighbor Dale Petersen because my mom was at her second job and somebody had to keep an eye on me, which is funny, because I was fifteen and mostly I kept an eye on his grain cart. His auger jammed at nine at night with rain coming. He was going to lose part of the corn. I had been building robots in Mr. Loger's shop for a year by then, and I could see the problem was a sheared bolt on the drive, and I fixed it with the shop light in my teeth while Dale held the flashlight, which means he held the good light while I used the bad one. It took twenty minutes. The corn came in ahead of the rain.\n\nDale told my mom I ought to be an engineer. My mom laughed. Then she stopped laughing and looked at me, and I have been chasing that look for two years.\n\nHere is what I know now that I did not know then. Fixing the auger was not the impressive part. Anybody around here can fix an auger. The impressive part is understanding why it sheared, which turned out to be a design that assumes the operator clears a jam before the torque spikes, which assumes the operator is not a tired 61-year-old racing weather at nine at night. Machines get designed for ideal operators. Farms do not have ideal operators. They have Dales.\n\nA field at night looks like the ocean, if the ocean was something you owed money on. I love that sentence and my English teacher says it is too much, and I am keeping it, because it is the truest thing I have ever written. I want to leave for Ames, learn agricultural engineering, and come back to build equipment for the farms nobody designs for. The small ones. The tired ones. Ours.",
  "careerGoal": "Agricultural engineering at Iowa State, then back to northwest Iowa, and I mean that specifically, not as a thing you say in an essay. The average Iowa farmer is 57 years old. Equipment keeps getting bigger, smarter, and more expensive, and all three of those are designed for operations ten times the size of the ones around Hartley. Precision ag right now means a $400,000 planter that texts you. Nobody is building the $4,000 retrofit that would let Dale Petersen's thirty-year-old equipment do variable-rate seeding.\n\nThat is the job I want. In ten years I want to be an engineer at a company like Vermeer or Ag Leader, or running my own shop if I can swing it, building retrofit precision equipment for small and mid-size farms. College fits into that because I have hit the ceiling of what I can teach myself. I can fix things. I can build a robot that stacks foam blocks. What I cannot do yet is the math that tells you where the torque spike comes from before the bolt shears, and I am done learning things one broken part at a time.\n\nI will be the first person in my family to apply to a four-year school. My mom has a magnet on the fridge from Iowa State that she will not admit she bought. We are both pretending it came free in the mail.",
  "writingStyle": "Warm and narrative — I tell stories"
}$profile_json$::jsonb,
  now()
FROM auth.users u
WHERE u.email = 'coreyskinner+ml-jenna@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gpa = EXCLUDED.gpa,
  intended_major = EXCLUDED.intended_major,
  heritage = EXCLUDED.heritage,
  citizenship = EXCLUDED.citizenship,
  financial_need = EXCLUDED.financial_need,
  activities = EXCLUDED.activities,
  profile_data = EXCLUDED.profile_data,
  updated_at = now();

-- ============ Amara Boyd (test-amara-chicago-arts-activism) ============
INSERT INTO public.user_profiles
  (id, name, gpa, grade_level, intended_major, heritage, citizenship, financial_need, activities, leadership, profile_data, updated_at)
SELECT u.id,
  'Amara Boyd',
  '3.6',
  NULL,
  'Journalism and African American Studies (double major)',
  'African American/Black',
  'U.S. Citizen',
  'Yes — moderate need',
  'Spoken word: Young Chicago Authors workshops since freshman year; Louder Than a Bomb team, two years, semifinals 2026. Self-published a chapbook, Grief Is a Group Project (24 poems, two printings, 200 copies, sold at open mics and on consignment at Semicolon Bookstore). Founder and host, Second Saturdays youth open mic at the Hall Branch library in Bronzeville. Features editor, Whitney Young Beacon. Co-organized the March 12 walkout over the librarian cut (212 students). Black Student Union, events chair. Church usher board, four years.',
  NULL,
  $profile_json${
  "name": "Amara Boyd",
  "email": "coreyskinner+ml-amara@gmail.com",
  "phone": "(773) 555-0138",
  "location": "Chicago, IL",
  "citizenship": "U.S. Citizen",
  "ethnicity": [
    "African American/Black"
  ],
  "gpa": "3.6",
  "satact": "1250 SAT",
  "school": "Whitney M. Young Magnet High School",
  "gradYear": "2027",
  "intendedMajor": "Journalism and African American Studies (double major)",
  "financialNeed": "Yes — moderate need",
  "activities": "Spoken word: Young Chicago Authors workshops since freshman year; Louder Than a Bomb team, two years, semifinals 2026. Self-published a chapbook, Grief Is a Group Project (24 poems, two printings, 200 copies, sold at open mics and on consignment at Semicolon Bookstore). Founder and host, Second Saturdays youth open mic at the Hall Branch library in Bronzeville. Features editor, Whitney Young Beacon. Co-organized the March 12 walkout over the librarian cut (212 students). Black Student Union, events chair. Church usher board, four years.",
  "awards": "Louder Than a Bomb team semifinalist, 2026. Scholastic Art & Writing Awards, Silver Key in poetry, 2025. Illinois Journalism Education Association, 2nd place, feature writing, 2026. Honor roll most semesters (the ones where AP Chem did not happen to me).",
  "communityService": "Second Saturdays is a youth open mic I started at the Hall Branch library the summer after sophomore year, because every mic I loved had a 21-and-over sign on the door or a 9 p.m. start my mama was never going to say yes to. Miss Pat, the branch manager, gave us the community room and one rule, which is that the poems can say anything but the mic goes off at 4:55 because the library closes at 5.\n\nWe average about thirty people. I book the features, run the list, and teach a 30-minute workshop for the middle schoolers who come early. The eighth graders are the best and worst audience alive. They will not clap politely for anything, and when a poem is real they go completely silent, and you can hear the bus outside on 48th, and that silence has taught more poets than I ever will.\n\nAbout 150 hours over two years, if hours are the measure. I do not think they are. The measure is that a seventh grader named Kayla read a poem about her granddad in October with her hood up, and in April she read one with her hood down. That is the whole program.",
  "personalStory": "The first thing you should know is that we lost.\n\nIn January the district cut the funding line for our librarian, Ms. Reyes-Whitmore, along with dozens of others across the city. Whitney Young is a school people point at, so everybody assumed we would be fine, and we were not fine. The library is where the poets ate lunch. It is where Ms. Reyes-Whitmore put The Fire Next Time in my hands junior year and said read the first letter, it's short. A man writing to his nephew in 1962, telling him the country had decided the terms of his life before he was born, and that he had to answer that with something harder than anger. I went home and wrote a letter to my little brother Marcus. It is in my chapbook. It is the only poem in there I still cannot read out loud all the way through.\n\nSo when the cut came, we organized. I say we because it was never just me. Deja ran the group chat, a different Marcus handled the aldermen's offices, I wrote the statement and read it. On March 12 at 8:14 a.m., 212 students walked out to the sidewalk on Jackson. I know it was 212 because Deja counted heads twice. I read the statement through a megaphone that died in the middle of the third sentence, so I said the rest with my own voice, which turned out to be the better instrument.\n\nThe district did not reverse the decision. Ms. Reyes-Whitmore packed up the displays in March and the shelves got quiet. What we got instead was smaller and realer: a meeting with two board members, a promise about next year's budget that we intend to collect on, and 212 people who now know what their feet are for.\n\nI used to think writing and organizing were two different rooms. They are the same room. Both start with somebody deciding that what happened to them deserves to be said plainly, in public, with their name on it. My granddad marched in this city in the sixties and will not talk about it, and my grandma talks about it enough for both of them, and I am starting to understand that the talking and the not-talking are both ways of carrying the same weight.\n\nWe are not done. We were never going to be done in one morning on one sidewalk. That is not defeat. That is the assignment.",
  "careerGoal": "Journalism and African American studies, double major. Howard is my first choice, Medill at Northwestern close behind, and yes, I know those are two very different bets. Howard is the family table. Medill is the newsroom with its name on the door. There is a version of me in both buildings, and I am going to let the financial aid letters moderate the debate.\n\nHere is why journalism. When we organized the walkout, the coverage got the facts right and the story wrong. The headline was about students skipping class. Nobody asked why a school like ours would fight that hard for one librarian, or what a library means in a neighborhood where the other quiet places keep closing. The people writing about us had never eaten lunch in that room. I kept thinking, we need our own reporters. And then I thought, oh. That can be me.\n\nIn ten years I want to be a features writer covering Black communities in Chicago with the patience they deserve, stories that run longer than a news cycle. African American studies is not a garnish on that plan. You cannot report on a neighborhood if you do not know how it got that way, block by block, policy by policy.\n\nCollege fits because every writer I love was built by rooms that took them seriously young. I have gotten to sit in two or three of those rooms already. I plan to spend four years in one, and then spend the rest of my life building them for other people.",
  "writingStyle": "Reflective and thoughtful — I go deep"
}$profile_json$::jsonb,
  now()
FROM auth.users u
WHERE u.email = 'coreyskinner+ml-amara@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gpa = EXCLUDED.gpa,
  intended_major = EXCLUDED.intended_major,
  heritage = EXCLUDED.heritage,
  citizenship = EXCLUDED.citizenship,
  financial_need = EXCLUDED.financial_need,
  activities = EXCLUDED.activities,
  profile_data = EXCLUDED.profile_data,
  updated_at = now();

-- ============ Daniel Yoon (test-daniel-bayarea-premed) ============
INSERT INTO public.user_profiles
  (id, name, gpa, grade_level, intended_major, heritage, citizenship, financial_need, activities, leadership, profile_data, updated_at)
SELECT u.id,
  'Daniel Yoon',
  '3.96',
  NULL,
  'Biology (pre-med)',
  'Asian/Pacific Islander',
  'U.S. Citizen',
  'No significant need',
  'Hospital volunteer, Washington Hospital in Fremont, 240 hours: discharge lounge and wayfinding desk. Science Olympiad, four years: Anatomy & Physiology and Disease Detectives, event captain senior year. Violin: California Youth Symphony senior orchestra, second violin section, plus school orchestra. Poongmul (Korean drumming) group at church, five years; we play the Fremont festival every fall. Peer tutor in chemistry, two years, about 60 hours.',
  NULL,
  $profile_json${
  "name": "Daniel Yoon",
  "email": "coreyskinner+ml-daniel@gmail.com",
  "phone": "(510) 555-0164",
  "location": "Fremont, CA",
  "citizenship": "U.S. Citizen",
  "ethnicity": [
    "Asian/Pacific Islander"
  ],
  "gpa": "3.96",
  "satact": "1520 SAT",
  "school": "Mission San Jose High School",
  "gradYear": "2027",
  "intendedMajor": "Biology (pre-med)",
  "financialNeed": "No significant need",
  "activities": "Hospital volunteer, Washington Hospital in Fremont, 240 hours: discharge lounge and wayfinding desk. Science Olympiad, four years: Anatomy & Physiology and Disease Detectives, event captain senior year. Violin: California Youth Symphony senior orchestra, second violin section, plus school orchestra. Poongmul (Korean drumming) group at church, five years; we play the Fremont festival every fall. Peer tutor in chemistry, two years, about 60 hours.",
  "awards": "National Merit Semifinalist, 2026. Science Olympiad: 2nd place, Anatomy & Physiology, NorCal state tournament 2026; 1st place regional, 2025 and 2026. AP Scholar with Distinction. Admitted to California Youth Symphony senior orchestra on my third audition, and the number three is doing real work in that sentence. Washington Hospital volunteer of the month, March 2026. 4.42 weighted GPA across 12 AP courses.",
  "communityService": "Two hundred forty hours in the discharge lounge at Washington Hospital, which is the room where patients wait, sometimes for hours, between being officially better and actually getting to leave. My job is water, warm blankets, wheelchairs, and conversation. Mostly conversation.\n\nThe training says do not get attached, which is reasonable advice that nobody follows. An 84-year-old patient waited four and a half hours one Saturday because his son's shift ran long, and in that time he taught me gin rummy with a deck from the gift shop and beat me eleven hands to two. He had been an engineer at the GM plant in Fremont before it closed. He told me the hardest part of being old is that everyone starts talking to you slowly. Then he watched me deal and said, faster.\n\nI signed up for hospital volunteering because I want to be a doctor, and I will not pretend otherwise. What I did not expect was that the medically boring room would turn out to be the instructive one. Nothing dramatic happens in discharge. What happens is dignity, or its absence, in one-minute increments. I keep count of my hours for the applications. I keep the gin rummy score for myself.",
  "personalStory": "My freshman year I auditioned for the California Youth Symphony and was cut before the end of my second excerpt. I had prepared for four months. I misread the key signature, played eleven measures a half step off before I heard it, and then, because I did not know what else to do, kept going. The panel said thank you at measure forty. In the parking lot my dad handed me the container of dumplings my mom had packed, which had gone cold, and we ate them without talking, and it remains the worst meal of my life and one of the best memories I have with my father, and I have given up trying to make those two facts behave.\n\nI should be honest about who I am, because I understand this essay is supposed to reveal me, and the truth is that I am careful. I am the person with the color-coded binder. I write formally, even now, even trying not to. Some of that is temperament and some of it is being the son of immigrants who checked my homework until I started checking it harder than they did. For a long time I thought of my carefulness as the thing that would get me somewhere, and of my failures as interruptions to it.\n\nThe audition rearranged that. What I remember is not the wrong notes. It is that I heard them, eleven measures in, understood that the audition was over, and finished anyway with the fullest sound I could make. I did not know I had that in me. You do not find out what you have until the plan is dead and you are still standing there holding a violin.\n\nI auditioned again my sophomore year and was cut again, closer. I got in the third year. This is an anticlimax and I am keeping it, because the third audition is not actually the point. The point is what I did the morning after the first one, which is that I got up and practiced, badly, with my eyes swollen, because it turns out I do not play the violin for auditions. I play because, measure by measure, it is the one place where my carefulness feels like freedom instead of fear.\n\nMedicine will be full of days where I hear the wrong note eleven measures in. I keep a list of things I have gotten wrong. It is longer than my awards list and considerably more useful, and I am no longer embarrassed by which one is growing faster.",
  "careerGoal": "The expected answer from someone with my transcript is surgery, and for two years that was my answer, mostly because it is the specialty people congratulate you for wanting. Then I spent 240 hours in a discharge lounge and got beaten at gin rummy by an 84-year-old former GM engineer, and I started paying attention to which patients waited longest, who arrived with a folder of their own medications organized by hand, who had nobody listed under emergency contact. The patients who taught me the most were all over seventy. The specialty almost nobody at my school ever mentions is geriatrics.\n\nSo: biology in college, medical school after, and then, if the plan survives contact with actual medical training, geriatric medicine. There is a projected shortage of thousands of geriatricians over the next decade, partly because it pays less than the specialties adjacent to it, which tells you something about what we optimize for. I would like to be part of the correction.\n\nCollege fits into this in an unglamorous way. I need organic chemistry, research experience, and four years of practice talking with people who are not like me, which I consider a prerequisite for a doctor whose patients will have sixty more years of life experience than he does. I also intend to keep playing violin in whatever orchestra will have me. Not for the application. There is no application anymore. That is rather the point.",
  "writingStyle": "Professional and polished — I sound mature"
}$profile_json$::jsonb,
  now()
FROM auth.users u
WHERE u.email = 'coreyskinner+ml-daniel@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gpa = EXCLUDED.gpa,
  intended_major = EXCLUDED.intended_major,
  heritage = EXCLUDED.heritage,
  citizenship = EXCLUDED.citizenship,
  financial_need = EXCLUDED.financial_need,
  activities = EXCLUDED.activities,
  profile_data = EXCLUDED.profile_data,
  updated_at = now();

-- ============ Mateo Ávila (test-mateo-elpaso-firstgen-lgbtq) ============
INSERT INTO public.user_profiles
  (id, name, gpa, grade_level, intended_major, heritage, citizenship, financial_need, activities, leadership, profile_data, updated_at)
SELECT u.id,
  'Mateo Ávila',
  '3.8',
  NULL,
  'Social Work / Public Policy',
  'Hispanic/Latino',
  'U.S. Citizen',
  'Yes — Pell-eligible',
  'Work: Carnicería Ávila, my grandfather''s shop, about 20 hours a week since freshman year: counter, cutting-room cleanup, the Saturday rush, and the books since junior year. Mock trial, three years: witness roles, then attorney; district semifinals. GSA, co-founder and president, the first one our school ever had, 19 members now. MEChA, treasurer; helped run two know-your-rights workshops at Sacred Heart parish. Ballet folklórico, two years (quit to take more shifts, still regret it a little). Interpreter at my old elementary school''s parent-teacher conferences, twice a year since sophomore year.',
  NULL,
  $profile_json${
  "name": "Mateo Ávila",
  "email": "coreyskinner+ml-mateo@gmail.com",
  "phone": "(915) 555-0129",
  "location": "El Paso, TX",
  "citizenship": "U.S. Citizen",
  "ethnicity": [
    "Hispanic/Latino"
  ],
  "gpa": "3.8",
  "satact": "1350 SAT",
  "school": "Ysleta High School",
  "gradYear": "2027",
  "intendedMajor": "Social Work / Public Policy",
  "financialNeed": "Yes — Pell-eligible",
  "activities": "Work: Carnicería Ávila, my grandfather's shop, about 20 hours a week since freshman year: counter, cutting-room cleanup, the Saturday rush, and the books since junior year. Mock trial, three years: witness roles, then attorney; district semifinals. GSA, co-founder and president, the first one our school ever had, 19 members now. MEChA, treasurer; helped run two know-your-rights workshops at Sacred Heart parish. Ballet folklórico, two years (quit to take more shifts, still regret it a little). Interpreter at my old elementary school's parent-teacher conferences, twice a year since sophomore year.",
  "awards": "District semifinalist, Texas High School Mock Trial, 2026, with an outstanding advocate award at regionals. National Honor Society. AP Scholar. Selected for Rotary Youth Leadership Awards (RYLA) camp, 2025. Honor roll every semester while working 20 hours a week, which I am counting as an award.",
  "communityService": "The service I do is not the kind with a sign-up sheet. Since sophomore year I have interpreted at parent-teacher conferences at my old elementary school, twice a year, maybe 60 hours total. The teacher talks, I turn it into Spanish a parent can use, and then I turn the parent's worry back into English with the dignity it had when it left their mouth. Interpreting is not translating words. It is making sure nobody in the room gets treated as less intelligent than they are.\n\nThrough MEChA I helped run two know-your-rights workshops at Sacred Heart parish. Setting up chairs, handing out the red cards from the legal aid group, walking abuelitas through what the card says, one line at a time. You do not have to open the door. You have the right to remain silent. I know those lines in both languages the way other kids know song lyrics.\n\nAnd every Saturday there is the carnicería, which is not community service, it is a job. But half the viejitos who come in at 7 a.m. are really there to talk to my abuelo, and when he is busy they talk to me, and somebody has to hear about everybody's knees. I count that as service to the community. The community seems to agree.",
  "personalStory": "There is a list taped inside our kitchen cabinet, behind the cups, of who picks up my little sister Ximena if my parents do not come home. My tía Lupe is first. I am second. We made it in February at the kitchen table, the way other families plan fire drills, and my mother laminated it with packing tape, because she laminates everything important. My parents have lived in El Paso for twenty-two years. They pay taxes on a business they cannot legally have in their own names, so it is in my abuelo's name. They have not driven past the Sierra Blanca checkpoint in a decade, which means they have never once seen me compete at state anything, because state anything is always in Austin, 570 miles and one checkpoint away.\n\nI am a citizen. That sentence does the work of a hundred at our house. It means I drive when we go anywhere far. It means the shop's new accounts got opened with my name on them the week I turned eighteen. It means I carry a kind of guilt there is no good Spanish or English word for, being safe inside a family that is not.\n\nThe other thing about me is that I am gay, and I was the first kid at my school to be out and stay out. I told my abuelo before I told my parents, on a Sunday while we cleaned the meat grinder, because I figured if it went badly I could leave and the grinder would still be clean. He listened. He was quiet a long time, long enough that the ice machine cycled twice. Then he said, ¿y? El molino no se limpia solo. And that was it. We finished the grinder. My abuelo is not a talker. He is a shower-upper, and the next week he introduced me to a supplier as mi nieto, el abogado, same as always, and I understood I was still exactly his.\n\nStarting the GSA was harder than coming out. Coming out was one afternoon. The GSA was eight months: paperwork, one rejected proposal, a teacher sponsor who backed out, another who stepped up, a first meeting where four kids showed. Now it is nineteen kids, and two of them have parents who think they are in chess club, and I keep their secret because I remember needing mine kept.\n\nI am not asking for sympathy for any of this. I am telling you what I am already good at. I am eighteen and I can hold a family plan, a business ledger, a secret, and a meat-grinder cleaning schedule all at once. Imagine what I could hold with training.",
  "careerGoal": "Social work or public policy. I keep both on the list because they are the same job at two different distances. A social worker sits with the family at the kitchen table. Policy decides how many problems are on the table to begin with. I have lived my whole life at that table, so I feel qualified to work at either distance.\n\nThe specific version: a bachelor's in social work at UT Austin or UTEP, then an MSW, then casework with mixed-status families in the border region. Eventually, and I say this part quietly because it sounds big out loud, policy work on how immigration enforcement intersects with child welfare. Right now, when parents get detained, whether a kid lands with family or with the state can depend on whether anyone in the room speaks Spanish and whether one form got filed in time. I have watched a legal aid caseworker walk my parents' friends through that exact form at our shop, after hours, at the counter where we usually weigh asada. The system runs on people like her. There are not enough of her.\n\nUTEP would let me stay close, keep my shifts, stay second on the pickup list for Ximena. UT Austin has the stronger program and a checkpoint between me and home. I am applying to both and I am not going to pretend the choice is simple. Whatever I choose, the goal does not move. I want to be, professionally, what I have been since I was fifteen behind the counter: the person in the room who makes the system make sense in both languages.",
  "writingStyle": "Warm and narrative — I tell stories"
}$profile_json$::jsonb,
  now()
FROM auth.users u
WHERE u.email = 'coreyskinner+ml-mateo@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gpa = EXCLUDED.gpa,
  intended_major = EXCLUDED.intended_major,
  heritage = EXCLUDED.heritage,
  citizenship = EXCLUDED.citizenship,
  financial_need = EXCLUDED.financial_need,
  activities = EXCLUDED.activities,
  profile_data = EXCLUDED.profile_data,
  updated_at = now();

-- ============ Nora Whitfield (test-nora-ct-classics-neurodivergent) ============
INSERT INTO public.user_profiles
  (id, name, gpa, grade_level, intended_major, heritage, citizenship, financial_need, activities, leadership, profile_data, updated_at)
SELECT u.id,
  'Nora Whitfield',
  '3.9',
  NULL,
  'Classics and Philosophy',
  'White/Caucasian',
  'U.S. Citizen',
  'No significant need',
  'Certamen (competitive Latin quiz bowl) team captain; Connecticut state competition, three years. Translations editor, school literary magazine (I sneak Sappho into every issue). Self-directed Attic and Homeric Greek: 14 months with Pharr''s textbook, then the Iliad itself, page tally kept and available on request. Volunteer book mender, Guilford Free Library, weekly, about 90 hours a year, plus running their summer D&D program for middle schoolers. Dungeon master for a weekly campaign, three years, same five players. That last one is my proudest leadership credential and I will not be reframing it.',
  NULL,
  $profile_json${
  "name": "Nora Whitfield",
  "email": "coreyskinner+ml-nora@gmail.com",
  "phone": "(203) 555-0186",
  "location": "Guilford, CT",
  "citizenship": "U.S. Citizen",
  "ethnicity": [
    "White/Caucasian"
  ],
  "gpa": "3.9",
  "satact": "1490 SAT",
  "school": "Hopkins School",
  "gradYear": "2027",
  "intendedMajor": "Classics and Philosophy",
  "financialNeed": "No significant need",
  "activities": "Certamen (competitive Latin quiz bowl) team captain; Connecticut state competition, three years. Translations editor, school literary magazine (I sneak Sappho into every issue). Self-directed Attic and Homeric Greek: 14 months with Pharr's textbook, then the Iliad itself, page tally kept and available on request. Volunteer book mender, Guilford Free Library, weekly, about 90 hours a year, plus running their summer D&D program for middle schoolers. Dungeon master for a weekly campaign, three years, same five players. That last one is my proudest leadership credential and I will not be reframing it.",
  "awards": "National Latin Exam, gold medal / Summa Cum Laude, three consecutive years. National Merit Semifinalist. Connecticut state Certamen, 2nd place team, 2026. AP Scholar with Honor. My school's translation prize, for a rendering of Iliad Book 6 that made my Latin teacher cry, which is the only award I have ever actually wanted.",
  "communityService": "Every Thursday after school I mend books at the Guilford Free Library. Torn spines, loose signatures, taped pages where a previous repair made everything worse. Mrs. Calabro trained me on my first afternoon with a broken copy of The Westing Game and one sentence, we do not throw away a book that can be saved, which I have thought about at least weekly since, and not only about books.\n\nIt is quiet, repetitive, precise work, roughly 90 hours a year, and it suits me completely. There is a correct order of operations. The glue takes exactly the time the glue takes. Nobody makes small talk. When I finish, a thing that was headed for the discard bin goes back into circulation, and some kid in Guilford checks out The Westing Game and never knows it was almost gone.\n\nI also run the library's summer D&D program for middle schoolers, which is not quiet. Eleven-year-olds do not have quiet as a setting. But a shy kid rolling dice behind a cardboard screen will talk in a voice you have not heard from them before, and I recognize the mechanism, because a screen is just a mask you get to put down afterward.",
  "personalStory": "I was diagnosed autistic at twelve, which surprised no one and explained everything, in roughly that order. Before twelve I had a system for being a person: scripts for greetings, a rule about eye contact (three seconds, look at the eyebrows, it reads the same), a running ledger of whether I had laughed at the correct volume. The system worked, in the way that holding your breath works. You can do it for a while, and it costs you everything else you might have been doing.\n\nThe diagnosis gave me permission to spend that effort elsewhere, and I spent it on Greek. At fourteen I found my grandfather's copy of Pharr's Homeric Greek, a famously unhinged textbook that starts you on the actual Iliad almost immediately, and I decided I would read the whole poem in the original before I turned sixteen. It took fourteen months. I kept a tally of pages on an index card. Page 41 took nine days.\n\nPeople assume the appeal is that Greek is a system, and autistic people like systems, and fine, partly. But here is the actual reason. In Book 6, Hector says goodbye to his wife, and reaches for his baby son, and the baby screams, because he does not recognize his father in the helmet. So Hector laughs, and takes the helmet off, and the baby knows him. I read that at eleven at night at the folding table in the basement, checked every word twice because I did not trust myself, and then put my head down on the dictionary. Someone wrote that scene almost three thousand years before anyone wrote the word autism. The problem of the mask is not a disorder. It is one of the oldest problems there is, and it comes with instructions. Take it off, and the people who love you will know you.\n\nSo I stopped masking. Mostly, gradually, with setbacks. I flap my hands when a translation lands. I say so when a party is too loud, instead of paying for it for three days afterward. Wittgenstein says the limits of my language are the limits of my world, and my response has been to acquire more languages: Latin, Greek, tabletop dice, the specific dialect of eleven-year-olds. Adventure Time puts the same idea more usefully, that sucking at something is the first step to being sort of good at something. Page 41 took nine days. Page 300 took an afternoon. That is the entire story of my life so far, and I intend to keep reading.",
  "careerGoal": "I want to study Classics and philosophy, ideally somewhere that considers reading old books out loud to be a complete lifestyle, which is why my list is St. John's College, Reed, and the University of Chicago rather than the usual suspects. St. John's does not even have majors. Everyone reads the same books for four years and argues about them at a table. When I read that in their catalog I felt the way other people describe feeling at football games.\n\nLong term, I want to teach and translate. There is a wave of new translations right now proving that the old books are not used up, that a different translator hears a different poem. I have opinions about Iliad Book 6 that I am prepared to defend for the rest of my life, and I would like the credentials to defend them in print. A doctorate eventually, then a classroom, ideally one with a folding table and no dress code.\n\nI am aware this plan makes no financial sense, and I am fortunate that it does not have to. My family can pay for college, which is why I am applying only for merit awards, and I want to be straightforward about what I want from one. Not tuition. What I want is the record of being taken seriously, by strangers, for the thing I actually am. There are plenty of documents that certify what I can score. I would like one that certifies what I love.",
  "writingStyle": "Reflective and thoughtful — I go deep"
}$profile_json$::jsonb,
  now()
FROM auth.users u
WHERE u.email = 'coreyskinner+ml-nora@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  gpa = EXCLUDED.gpa,
  intended_major = EXCLUDED.intended_major,
  heritage = EXCLUDED.heritage,
  citizenship = EXCLUDED.citizenship,
  financial_need = EXCLUDED.financial_need,
  activities = EXCLUDED.activities,
  profile_data = EXCLUDED.profile_data,
  updated_at = now();

-- Sanity check:
-- SELECT u.email, p.name, p.gpa, p.profile_data->>'school' AS school
-- FROM public.user_profiles p JOIN auth.users u ON u.id = p.id
-- WHERE u.email LIKE 'coreyskinner+ml-%';
