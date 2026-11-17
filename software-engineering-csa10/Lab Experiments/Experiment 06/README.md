# Experiment 6 – UML Class, Use Case and Activity Diagrams for an Online Food Delivery System

**Tool:** Umbrello UML Modeller  |  **Course Outcome:** CO1

## Aim
To model an Online Food Delivery System using UML class, use case and activity diagrams.

## System overview
Customers browse restaurants, add items to a cart, place an order and pay online. The restaurant accepts and prepares the order, a delivery agent picks it up and delivers it, and the customer can track and review the order. An admin manages users and restaurants.

## 1. Class Diagram
Classes: Customer, Address, Cart, Restaurant, MenuItem, Order, OrderItem, Payment, Delivery, DeliveryAgent.

![Class diagram](diagrams/exp06_class_diagram.png)

## 2. Use Case Diagram
Actors: Customer, Restaurant Owner, Delivery Agent, Admin, Payment Gateway. Relationships shown: `<<include>>` (Place Order → Add to Cart, Make Payment) and `<<extend>>` (Apply Coupon, Cancel Order).

![Use case diagram](diagrams/exp06_use_case_diagram.png)

## 3. Activity Diagram
Swimlanes: Customer, System, Restaurant, Delivery Agent – from login to delivery, including payment-failure and order-rejection paths.

![Activity diagram](diagrams/exp06_activity_diagram.png)

## Source files
PlantUML sources are in [`diagrams/`](diagrams/) (`.puml`). Render with `java -jar plantuml.jar diagrams/*.puml`.

## Umbrello screenshots
Recreate the three diagrams in Umbrello (File → New, then Diagram → New → Class / Use Case / Activity), save the model as `food_delivery.xmi`, and place screenshots and the `.xmi` file in [`screenshots/`](screenshots/).

## Result
The class, use case and activity diagrams together describe the structure, functional requirements and workflow of the Online Food Delivery System.
