# UI Conventions

## Button Usage Rules

### Touch Target Requirement

ALL interactive elements must be **minimum 44px** touch target (Apple/Google HIG). The `<Button>` component enforces `min-h-11` (44px) on all sizes by default. Do not override this with smaller values.

### Size Variants

| Size | Class | Use Case |
|------|-------|----------|
| `default` | `h-9 px-4` | Standard buttons — forms, CTAs, dialogs |
| `sm` | `h-9 px-3 gap-1.5` | Compact text — toolbar actions, inline actions, secondary controls |
| `lg` | `h-11 px-6` | Hero / landing page CTAs |
| `icon` | `size-9 min-w-11` | Icon-only buttons — header icons, toggles |
| `icon-sm` | `size-9 min-w-11` | Icon-only buttons in tighter layouts |

All sizes enforce `min-h-11` (44px) via base styles.

### Variant Conventions

| Variant | Use Case |
|---------|----------|
| `default` | Primary CTA — submit, save, create |
| `outline` | Secondary actions — cancel, back, alternative options |
| `ghost` | Tertiary actions — toolbar buttons, toggles, show/hide, icon actions |
| `destructive` | Delete, remove, dangerous actions (always in confirmation dialog) |
| `link` | Inline text links styled as buttons |
| `secondary` | Alternative primary style (rarely used) |

### Pattern Conventions

#### Full-Width Buttons (Auth Pages, Forms)
```tsx
<Button className="w-full">Primary Action</Button>
<Button variant="outline" className="w-full">Secondary Action</Button>
<Button variant="ghost" className="w-full">Back / Cancel</Button>
```

#### Dialog Action Buttons
```tsx
<Button variant="outline">Cancel</Button>  {/* Left */}
<Button>Save / Confirm</Button>             {/* Right */}
```

#### Toolbar / Action Bar
```tsx
<Button variant="ghost" size="sm">
  <Icon className="mr-1 h-3 w-3" /> Label
</Button>
```

#### Icon-Only Buttons
```tsx
<Button variant="ghost" size="icon">
  <Icon className="h-4 w-4" />
</Button>
```

#### Pagination
```tsx
<Button variant="outline" size="icon">
  <ChevronLeft className="h-4 w-4" />
</Button>
```

### Rules

1. **Never add manual sizing classNames** like `h-8`, `w-8`, `p-0`, `min-h-[44px]` to buttons. Use size variants instead.
2. **Layout classNames are OK**: `w-full`, `flex-1`, `mt-4` etc. are fine.
3. **Conditional color classNames are OK**: Active state colors like `bg-emerald-100` on vote buttons.
4. **Icon sizing inside buttons**: Use `h-3 w-3` for `size="sm"`, `h-4 w-4` for `size="default"` and `size="icon"`.
5. **All interactive elements** (buttons, links-as-buttons, menu triggers) must meet 44px minimum touch target.
