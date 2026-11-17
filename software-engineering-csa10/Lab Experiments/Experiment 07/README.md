# Experiment 7 – UML Diagrams for a College Security Management System

**Tool:** Umbrello UML Modeller  |  **Course Outcome:** CO1

## Aim
To model a College Security Management System using UML class, use case and activity diagrams.

## System overview
Students and staff enter the campus using access cards; visitors are registered by security guards and given passes. Guards monitor gates and cameras, log entries and exits, and report incidents. The admin issues and blocks cards, manages guards, and reviews logs and reports.

## 1. Class Diagram
Classes: Person (abstract), Student, Staff, Visitor, SecurityGuard, Admin, AccessCard, Gate, AccessLog, Incident, Camera, Alarm. Inheritance: Student, Staff and Visitor specialise Person.

![Class diagram](diagrams/exp07_class_diagram.png)

## 2. Use Case Diagram
Actors: Student/Staff, Visitor, Security Guard, Admin.

![Use case diagram](diagrams/exp07_use_case_diagram.png)

## 3. Activity Diagram
Campus entry workflow for cardholders and visitors, including invalid-card handling and incident reporting.

![Activity diagram](diagrams/exp07_activity_diagram.png)

## Source files
PlantUML sources are in [`diagrams/`](diagrams/) (`.puml`). Render with `java -jar plantuml.jar diagrams/*.puml`.

## Umbrello screenshots
Recreate the three diagrams in Umbrello, save the model as `college_security.xmi`, and place screenshots and the `.xmi` file in [`screenshots/`](screenshots/).

## Result
The three diagrams capture the static structure, user interactions and entry-control workflow of the College Security Management System.
