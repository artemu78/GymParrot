# React Web App Standards

## Component Patterns
- Always use **Functional Components** with the `const` keyword.
- Prefer **Tailwind CSS** for all styling; do not create separate `.css` or `.scss` files.
- Use **Lucide React** for icons by default.

## State Management
- Use `useState` for simple local state and `useReducer` for complex logic.
- Always place hooks at the very top of the component body.

## Code Quality
- Add JSDoc comments to all props to explain their purpose.
- Use `export default` for the main component in each file.