'use strict';
/* SetsBuddy exercise library, grouped by main muscle. Add names freely; custom ones are saved in-app. */
const EXERCISE_LIBRARY = {
  Chest: [
    'Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Close-Grip Bench Press', 'Paused Bench Press',
    'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Decline Dumbbell Press', 'Dumbbell Fly', 'Incline Dumbbell Fly',
    'Cable Fly', 'Low-to-High Cable Fly', 'High-to-Low Cable Fly', 'Pec Deck', 'Machine Chest Press',
    'Incline Machine Press', 'Smith Machine Bench Press', 'Push Up', 'Incline Push Up', 'Decline Push Up',
    'Weighted Push Up', 'Chest Dip', 'Svend Press', 'Landmine Press', 'Floor Press'
  ],
  Back: [
    'Deadlift', 'Sumo Deadlift', 'Rack Pull', 'Pull Up', 'Weighted Pull Up', 'Chin Up', 'Weighted Chin Up',
    'Neutral-Grip Pull Up', 'Assisted Pull Up', 'Lat Pulldown', 'Close-Grip Lat Pulldown', 'Single-Arm Lat Pulldown',
    'Straight-Arm Pulldown', 'Barbell Row', 'Pendlay Row', 'Dumbbell Row', 'Chest-Supported Row', 'Seal Row',
    'T-Bar Row', 'Seated Cable Row', 'Wide-Grip Cable Row', 'Machine Row', 'Inverted Row', 'Meadows Row',
    'Back Extension', 'Good Morning', 'Shrug', 'Dumbbell Shrug', 'Face Pull', 'Reverse Fly', 'Superman'
  ],
  Shoulders: [
    'Overhead Press', 'Seated Overhead Press', 'Push Press', 'Dumbbell Shoulder Press', 'Seated Dumbbell Press',
    'Arnold Press', 'Machine Shoulder Press', 'Smith Machine Shoulder Press', 'Lateral Raise', 'Cable Lateral Raise',
    'Machine Lateral Raise', 'Leaning Lateral Raise', 'Front Raise', 'Plate Front Raise', 'Rear Delt Fly',
    'Reverse Pec Deck', 'Rear Delt Cable Fly', 'Upright Row', 'Cable Upright Row', 'Landmine Shoulder Press',
    'Y Raise', 'Pike Push Up', 'Handstand Push Up'
  ],
  Biceps: [
    'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Alternating Dumbbell Curl', 'Hammer Curl', 'Cross-Body Hammer Curl',
    'Incline Dumbbell Curl', 'Preacher Curl', 'Machine Preacher Curl', 'Concentration Curl', 'Cable Curl',
    'Bayesian Cable Curl', 'Rope Hammer Curl', 'Spider Curl', 'Reverse Curl', 'Drag Curl', 'Zottman Curl'
  ],
  Triceps: [
    'Tricep Pushdown', 'Rope Pushdown', 'Single-Arm Pushdown', 'Overhead Tricep Extension', 'Cable Overhead Extension',
    'Skull Crusher', 'Dumbbell Skull Crusher', 'JM Press', 'Dip', 'Weighted Dip', 'Bench Dip', 'Tricep Kickback',
    'Diamond Push Up', 'Machine Tricep Extension', 'Tate Press'
  ],
  Forearms: [
    'Wrist Curl', 'Reverse Wrist Curl', "Farmer's Carry", 'Dead Hang', 'Plate Pinch', 'Wrist Roller'
  ],
  Quads: [
    'Squat', 'High-Bar Squat', 'Low-Bar Squat', 'Front Squat', 'Pause Squat', 'Box Squat', 'Goblet Squat',
    'Hack Squat', 'Pendulum Squat', 'Smith Machine Squat', 'Belt Squat', 'Safety Bar Squat', 'Leg Press',
    'Single-Leg Press', 'Leg Extension', 'Bulgarian Split Squat', 'Split Squat', 'Walking Lunge', 'Reverse Lunge',
    'Forward Lunge', 'Step Up', 'Sissy Squat', 'Pistol Squat', 'Wall Sit'
  ],
  Hamstrings: [
    'Romanian Deadlift', 'Dumbbell Romanian Deadlift', 'Single-Leg Romanian Deadlift', 'Stiff-Leg Deadlift',
    'Lying Leg Curl', 'Seated Leg Curl', 'Standing Leg Curl', 'Nordic Curl', 'Glute Ham Raise', 'Cable Pull Through',
    'Kettlebell Swing'
  ],
  Glutes: [
    'Hip Thrust', 'Single-Leg Hip Thrust', 'Machine Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Glute Kickback Machine',
    'Hip Abduction', 'Hip Adduction', 'Cable Hip Abduction', 'Frog Pump', 'Curtsy Lunge', 'Sumo Squat'
  ],
  Calves: [
    'Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise', 'Smith Machine Calf Raise',
    'Single-Leg Calf Raise', 'Donkey Calf Raise', 'Tibialis Raise'
  ],
  Core: [
    'Plank', 'Side Plank', 'Crunch', 'Cable Crunch', 'Machine Crunch', 'Decline Crunch', 'Sit Up', 'Hanging Leg Raise',
    'Hanging Knee Raise', 'Lying Leg Raise', 'Captain\'s Chair Leg Raise', 'Ab Wheel Rollout', 'Russian Twist',
    'Bicycle Crunch', 'Mountain Climber', 'Dead Bug', 'Bird Dog', 'Hollow Hold', 'V-Up', 'Toes to Bar',
    'Pallof Press', 'Cable Woodchopper', 'Dragon Flag', 'Suitcase Carry'
  ],
  'Full body': [
    'Power Clean', 'Hang Clean', 'Clean and Jerk', 'Snatch', 'Thruster', 'Burpee', 'Kettlebell Clean',
    'Kettlebell Snatch', 'Turkish Get Up', 'Man Maker', 'Sled Push', 'Sled Pull', 'Battle Ropes', 'Box Jump',
    'Medicine Ball Slam', 'Wall Ball', 'Sandbag Carry'
  ],
  Cardio: [
    'Running', 'Treadmill', 'Incline Walk', 'Walking', 'Cycling', 'Stationary Bike', 'Assault Bike', 'Rowing Machine',
    'Elliptical', 'Stair Climber', 'Jump Rope', 'Swimming', 'Hiking', 'Ski Erg', 'Sprints'
  ]
};
