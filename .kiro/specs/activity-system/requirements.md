# Requirements Document

## Introduction

The Activity System is the core feature of GymParrot that enables trainers to create pose and movement activities using MediaPipe pose detection, and allows trainees to attempt these activities with real-time feedback. The system leverages Google's MediaPipe Pose Landmark Detection to track and compare human movements in real-time through a web interface.

## Requirements

### Requirement 1

**User Story:** As a trainer, I want to create pose activities by recording single poses, so that trainees can practice specific body positions.

#### Acceptance Criteria

1. WHEN a trainer clicks "Create Activity" THEN the system SHALL present options for "Pose" or "Moves"
2. WHEN a trainer selects "Pose" THEN the system SHALL display a record button and activate webcam access
3. WHEN a trainer clicks "Record" for a pose THEN the system SHALL capture a single pose using MediaPipe PoseLandmarker
4. WHEN pose recording is complete THEN the system SHALL save the pose landmarks to AWS DynamoDB
5. IF webcam access is denied THEN the system SHALL display an error message and disable recording functionality

### Requirement 2

**User Story:** As a trainer, I want to create movement activities by recording sequences of movements, so that trainees can practice dynamic exercises.

#### Acceptance Criteria

1. WHEN a trainer selects "Moves" THEN the system SHALL display duration options (10 or 30 seconds) and a record button
2. WHEN a trainer clicks "Record" for moves THEN the system SHALL continuously track poses using MediaPipe detectForVideo for the selected duration
3. WHEN movement recording is in progress THEN the system SHALL display a countdown timer and visual feedback
4. WHEN movement recording is complete THEN the system SHALL save the sequence of pose landmarks with timestamps to AWS DynamoDB
5. WHEN recording duration expires THEN the system SHALL automatically stop recording and save the activity

### Requirement 3

**User Story:** As a trainee, I want to view available activities, so that I can choose which exercises to practice.

#### Acceptance Criteria

1. WHEN a trainee accesses the activities page THEN the system SHALL display all publicly available activities
2. WHEN displaying activities THEN the system SHALL show activity type (Pose or Moves), duration
3. WHEN a trainee selects an activity THEN the system SHALL load the activity details and prepare for practice mode
4. IF no activities are available THEN the system SHALL display a message indicating no activities found

### Requirement 4

**User Story:** As a trainee, I want to attempt pose activities with real-time feedback, so that I can improve my form and technique.

#### Acceptance Criteria

1. Trainee can select difficulty level: Soft, Medium, Hard and it reflect thereshold for system to consider his pose accuarate enough
2. WHEN a trainee starts a pose activity THEN the system SHALL activate webcam and initialize MediaPipe PoseLandmarker
3. WHEN the trainee is in position THEN the system SHALL continuously compare their pose against the recorded pose landmarks
4. WHEN pose comparison is within threshold THEN the system SHALL indicate success with visual feedback
5. WHEN pose comparison exceeds threshold THEN the system SHALL provide guidance on how to improve positioning
6. IF webcam tracking fails THEN the system SHALL display error message and allow retry

### Requirement 5

**User Story:** As a trainee, I want to attempt movement activities with real-time tracking, so that I can practice dynamic exercises with feedback.

#### Acceptance Criteria

1. WHEN a trainee starts a movement activity THEN the system SHALL activate webcam and begin continuous pose tracking
2. WHEN tracking movements THEN the system SHALL compare trainee's pose sequence against recorded landmarks with timestamps
3. WHEN movement sequence matches within threshold THEN the system SHALL provide positive feedback
4. WHEN movement deviates from recorded sequence THEN the system SHALL provide corrective guidance
5. WHEN activity duration completes THEN the system SHALL display overall performance summary

### Requirement 8

**User Story:** As a trainer, I want my activities to be saved securely, so that they persist and can be accessed by trainees.

#### Acceptance Criteria

1. WHEN an activity is recorded THEN the system SHALL save pose landmarks data to AWS DynamoDB
2. WHEN saving to database THEN the system SHALL include activity metadata (type, duration, creator, timestamp)
3. WHEN database save is successful THEN the system SHALL confirm activity creation to the trainer
4. IF database save fails THEN the system SHALL display error message and allow retry
5. WHEN activities are retrieved THEN the system SHALL load pose landmarks and metadata from DynamoDB

### Requirement 9

**User Story:** As a user, I want the pose detection to work reliably in real-time, so that I can have a smooth experience during recording and practice.

#### Acceptance Criteria

1. WHEN MediaPipe PoseLandmarker is initialized THEN the system SHALL use createFromOptions method with appropriate configuration
2. WHEN processing video frames THEN the system SHALL use detectForVideo method for continuous tracking
3. WHEN pose detection is active THEN the system SHALL maintain consistent frame rate for smooth user experience
4. IF pose detection fails THEN the system SHALL attempt to reinitialize and notify user of any issues
5. WHEN pose landmarks are detected THEN the system SHALL extract and process coordinate data for comparison
