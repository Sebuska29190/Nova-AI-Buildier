# Plan: Fix GUI Runtime Breakage After Svelte 5→4 Migration

## Root Cause Analysis

The build succeeds (266 modules transformed, exit code 0), but the GUI is broken at runtime. Two primary issues have been identified:

### Issue 1: Dynamic Component Rendering in App.svelte (CRITICAL)

**File:** [`packages/ui/src/App.svelte`](packages/ui/src/App.svelte:154-164)

Current code:
```svelte
{#if pages[route]}
  {@const Comp = pages[route]}
  <Comp
    {models}
    {skills}
    ...
  />
```

**Problem:** In Svelte 4, `{@const}` creates a **non-reactive** local variable. When `route` changes (via sidebar click → `onRoute(item.id)`), the `{#if}` block re-evaluates, but `{@const Comp = ...}` may not properly re-assign the component reference in a way that triggers re-rendering. The `<Comp>` tag is a static component reference, not a dynamic one.

**Fix:** Replace with [`<svelte:component>`](https://svelte.dev/docs/svelte-components#svelte-component) which is Svelte 4's built-in mechanism for dynamic component rendering:

```svelte
{#if pages[route]}
  <svelte:component this={pages[route]}
    {models}
    {skills}
    {agents}
    {sessions}
    onResolved={() => {}}
    onRefresh={() => refresh()}
    onSessionChange={() => refresh()}
  />
```

### Issue 2: Toast.svelte Reactive Statement Bug

**File:** [`packages/ui/src/lib/components/ui/Toast.svelte`](packages/ui/src/lib/components/ui/Toast.svelte:9-16)

Current code:
```svelte
$: if (message) {
  visible = true;
  const timer = setTimeout(() => {
    visible = false;
    setTimeout(() => onclose?.(), 300);
  }, duration);
}
```

**Problem:** The `$:` reactive statement runs every time `message` changes, but the `timer` variable is local and never cleaned up. If `message` changes rapidly, multiple timers accumulate. Also, `onclose?.()` uses optional chaining which may not work in all Svelte 4 compilation contexts.

**Fix:** Use a proper cleanup pattern with `onDestroy`:

```svelte
let timer: ReturnType<typeof setTimeout> | undefined;

$: if (message) {
  visible = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    visible = false;
    setTimeout(() => { if (onclose) onclose(); }, 300);
  }, duration);
}
```

### Issue 3: Prop Mismatches (Potential)

**File:** [`packages/ui/src/App.svelte`](packages/ui/src/App.svelte:156-163)

`App.svelte` passes these props to all child components:
- `{models}` (plural, `Array<{id: string}>`)
- `{skills}` (plural, `any[]`)
- `{agents}` (plural, `any[]`)
- `{sessions}` (plural, `any[]`)
- `onResolved`, `onRefresh`, `onSessionChange`

But child components declare different props:
- [`ChatPage.svelte`](packages/ui/src/routes/ChatPage.svelte:15) expects `export let model` (singular string), not `models` (plural array)
- Some components don't declare `onResolved`/`onRefresh`/`onSessionChange` as `export let`

**Fix:** Ensure all components that receive these props declare them properly. For components that don't use certain props, Svelte 4 will just ignore extra props passed to `<svelte:component>`.

## Implementation Steps

### Step 1: Fix App.svelte - Dynamic Component Rendering
- Replace `{@const Comp = pages[route]}` + `<Comp>` with `<svelte:component this={pages[route]}>`
- This is the most likely cause of navigation not switching between functions

### Step 2: Fix Toast.svelte - Timer Cleanup
- Add proper timer variable and cleanup in the `$:` reactive block
- Replace `onclose?.()` with explicit null check `if (onclose) onclose()`

### Step 3: Verify Build
- Run `npm run build` or `bun run build` to ensure no compilation errors

### Step 4: Test
- Verify navigation switching between pages works
- Verify chat message sending works
- Check browser console for any runtime errors

## Expected Outcome

After these fixes:
1. Clicking sidebar navigation items should switch between pages correctly
2. Chat messages should send and display responses
3. Toast notifications should appear and auto-dismiss correctly
4. No runtime errors in browser console
