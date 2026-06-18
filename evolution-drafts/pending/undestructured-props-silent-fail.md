# Undestructured Props Fail Silently

## Rule

**When a component receives props via an interface, verify ALL props are destructured.** Missing a prop in destructuring causes no compile error and no runtime error — just silently broken functionality.

## Why

In `ChatPage.tsx`, the component had `sessions` and `onRefresh` in its `ChatPageProps` interface, but the destructured parameters omitted them. App.tsx was passing `sessions={sessions}` correctly, but ChatPage never received the data. The result: sessions existed in the database but appeared nowhere in the chat UI. Users couldn't restore chat history.

The critical sign: no TypeScript error, no console warning, no build failure. Just missing functionality.

## Detection Pattern

When debugging "X doesn't work" issues:
1. Check if the data is being passed from the parent (App.tsx)
2. Check if the child component actually destructures that prop
3. A mismatch between interface and destructuring = silent failure

## Prevention

```typescript
// ❌ WRONG — sessions is in the interface but NOT destructured
export function ChatPage({ models = [], skills = [] }: ChatPageProps) {
  // sessions is in ChatPageProps but never received
}

// ✅ CORRECT — all interface props are destructured
export function ChatPage({
  models = [], skills = [], agents = [], sessions = [], onRefresh,
}: ChatPageProps) {
  // sessions is now available
}
```

## Source

ChatPage.tsx session history system (2026-06-18). `sessions` prop was passed from App.tsx but not destructured in ChatPage, making it appear that session loading was broken when actually the data just wasn't being received.
