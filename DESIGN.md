# Amoga App UI/UX Design System Specification (`DESIGN.md`)

This document serves as the **Single Source of Truth** for the UI/UX design language of `amogamobiledev1` and `amogamobileds-v1`. Any AI model or software engineer should follow this exact specification when designing or implementing new screens (e.g., Email, Files, Tasks, Notifications, Settings) to ensure 100% visual and interactive consistency.

---

## 📐 1. Master 2-Pane Architecture

The standard desktop layout consists of a **Left Sidebar** (Navigation & Item List) and a **Right Viewport** (Detail & Interactive Workspace):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ROOT CONTAINER (flex: 1, height: 100vh)              │
├───────────────────────┬────────────────────────────────────────────────────────────────┤
│   LEFT SIDEBAR        │                      RIGHT VIEWPORT (flex: 1)                  │
│   (width: 320px)      │                                                                │
│                       ├────────────────────────────────────────────────────────────────┤
│ 1. Horizontal Subtabs │ 1. Top Header Bar (height: 56px)                              │
│    (Chats | Contact)  │    [Avatar / Icon] Title · Status / Badge       [Action Icons] │
│ 2. Search Bar         ├────────────────────────────────────────────────────────────────┤
│    [Q Search...]      │                                                                │
│ 3. Section Header     │ 2. Main Content Canvas / Message List / Calendar Grid          │
│    💬 CHATS ──── 2    │                                                                │
│ 4. Card Items List    │                                                                │
│    ┌──────────────┐   │                                                                │
│    │ Active Card  │   │                                                                │
│    ├──────────────┤   │                                                                │
│    │ Card Item    │   │                                                                │
│    └──────────────┘   ├────────────────────────────────────────────────────────────────┤
│                       │ 3. Bottom Input Bar / Action Toolbar (height: 60px)            │
└───────────────────────┴────────────────────────────────────────────────────────────────┘
```

---

## 🎨 2. Design Tokens & Color Palette

### Base Theme Variables
| Element | Light Mode | Dark Mode |
| :--- | :--- | :--- |
| **Canvas Background** | `#ffffff` | `#09090b` |
| **Sidebar Background** | `#ffffff` | `#09090b` |
| **Card Background** | `#ffffff` | `#18181b` |
| **Card Active Background** | `#eef2ff` | `rgba(99, 102, 241, 0.16)` |
| **Card Active Border** | `rgba(199, 210, 254, 0.8)` | `rgba(99, 102, 241, 0.4)` |
| **Primary Accent** | `#4f46e5` (Indigo/Violet) | `#818cf8` / `#a5b4fc` |
| **Border / Divider** | `#e2e8f0` / `#f1f5f9` | `#27272a` / `#1e222d` |
| **Text Primary** | `#0f172a` | `#f4f4f5` |
| **Text Secondary / Muted** | `#64748b` | `#94a3b8` |

### Category / Status Badge Colors
- **Emerald / Active**: Background `rgba(16, 185, 129, 0.12)`, Border `rgba(167, 243, 208, 0.8)`, Text `#059669` (Dark text `#34d399`).
- **Blue / Design**: Background `rgba(59, 130, 246, 0.12)`, Border `rgba(191, 219, 254, 0.8)`, Text `#2563eb` (Dark text `#60a5fa`).
- **Purple / Dev**: Background `rgba(139, 92, 246, 0.12)`, Border `rgba(221, 214, 254, 0.8)`, Text `#7c3aed` (Dark text `#a78bfa`).
- **Amber / Work**: Background `rgba(245, 158, 11, 0.12)`, Border `rgba(254, 243, 199, 0.8)`, Text `#d97706` (Dark text `#fbbf24`).
- **Red / Urgent**: Background `rgba(239, 68, 68, 0.12)`, Border `rgba(254, 202, 202, 0.8)`, Text `#dc2626` (Dark text `#f87171`).

---

## 🔤 3. Typography Rules

- **Font Family**: `Open Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Page / Section Header**: `fontSize: 16px`, `fontWeight: 700`, `letterSpacing: -0.3px`
- **Card Title**: `fontSize: 13.5px`, `fontWeight: 600`, `letterSpacing: -0.2px`
- **Card Snippet / Subtitle**: `fontSize: 11.5px`, `color: mutedForeground`, `lineHeight: 16px`
- **Tab Labels**: `fontSize: 13px`, `letterSpacing: -0.1px` (Active: `fontWeight: 500`, Inactive: `fontWeight: 400`)
- **Section Headers**: `fontSize: 11px`, `fontWeight: 700`, `letterSpacing: 0.5px`, `textTransform: uppercase`
- **Timestamps / Badges**: `fontSize: 10px - 11px`, `fontWeight: 500`

---

## 📑 4. Left Sidebar Components Specification

### A. Horizontal Subtabs Bar
```tsx
<View style={styles.tabsRow}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
    {tabs.map((tab) => (
      <Pressable key={tab.id} onPress={() => onTabChange(tab.id)} style={styles.tabBtn}>
        <Text style={[styles.tabLabel, { color: isSelected ? activeColor : inactiveColor }]}>
          {tab.label}
        </Text>
        {isSelected && <View style={styles.activeIndicator} />}
      </Pressable>
    ))}
  </ScrollView>
</View>
```
- **Container**: `height: 44px`, `borderBottomWidth: 1`, `borderBottomColor: border`, `paddingHorizontal: 12px`, `paddingTop: 10px`.
- **Tabs Gap**: `gap: 18px`.
- **Active Underline**: `position: absolute`, `bottom: 0`, `left: 0`, `right: 0`, `height: 2.5px`, `borderRadius: 9999px`, `backgroundColor: primary`.

### B. Rounded Search Bar
```tsx
<View style={styles.searchSection}>
  <View style={styles.searchWrapper}>
    <Search size={14} color={mutedColor} strokeWidth={2} style={styles.searchIcon} />
    <TextInput
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder="Search..."
      placeholderTextColor={mutedColor}
      style={styles.searchInput}
    />
  </View>
</View>
```
- **Section Padding**: `paddingHorizontal: 12px`, `paddingVertical: 10px`.
- **Wrapper**: `height: 36px`, `borderRadius: 12px`, `borderWidth: 1`, `borderColor: border`, `paddingHorizontal: 10px`, `gap: 8px`.
- **Inner Input**: `borderWidth: 0`, `backgroundColor: transparent`, `fontSize: 12.5px`, `outline: none` (Web: `outlineStyle: 'none', outlineWidth: 0, outline: 'none'`).

### C. Section Header Divider
```tsx
<View style={styles.sectionHeader}>
  <IconComponent size={14} color={accentColor} strokeWidth={2.2} />
  <Text style={styles.sectionLabel}>{sectionLabel.toUpperCase()}</Text>
  <View style={styles.sectionDivider} />
  <Text style={styles.sectionCount}>{count}</Text>
</View>
```
- **Layout**: `flexDirection: 'row'`, `alignItems: 'center'`, `paddingHorizontal: 14px`, `paddingVertical: 6px`, `gap: 8px`.
- **Divider Rule**: `flex: 1`, `height: 1px`, `backgroundColor: border`.

### D. Card Item (`ChatCardItem` Standard)
```tsx
<Pressable style={[styles.card, isActive ? styles.cardActive : styles.cardInactive]}>
  {isActive && <View style={styles.indicatorBar} />}
  
  {/* Row 1: Title, Badge, Time */}
  <View style={styles.headerRow}>
    <View style={styles.titleWithBadge}>
      <Text style={styles.titleText}>{title}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{category}</Text>
      </View>
    </View>
    <Text style={styles.timeText}>{time}</Text>
  </View>

  {/* Row 2: Snippet / Subtitle */}
  <Text style={styles.lastMessageText} numberOfLines={1}>{subtitle}</Text>
</Pressable>
```
- **Card**: `borderRadius: 12px`, `padding: 12px`, `borderWidth: 1`, `overflow: 'hidden'`, `gap: 4px`.
- **Active Indicator Strip**: `position: absolute`, `left: 0`, `top: 6px`, `bottom: 6px`, `width: 3.5px`, `borderRadius: 2px`, `backgroundColor: primary`.

### E. Right Viewport Top Header Bar
```tsx
<View style={[styles.rightHeaderBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
  <View style={styles.rightHeaderTitleRow}>
    <Text style={[styles.rightHeaderTitle, { color: colors.foreground }]}>{title}</Text>
  </View>
  {onClose && (
    <Pressable onPress={onClose} style={styles.closeBtn}>
      <X size={16} color={colors.mutedForeground} strokeWidth={2} />
    </Pressable>
  )}
</View>
```
- **Header Bar Layout**: `height: 56px`, `paddingHorizontal: 20px`, `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`, `borderBottomWidth: 1`, `borderBottomColor: border`.
- **Title Style**: `fontSize: 16px`, `fontWeight: '700'`, `fontFamily: 'Open Sans'`, `letterSpacing: -0.3px`. (e.g. `My Calendar`, `Preferences`, `My Profile`, `Theme Settings`, `My Map`).
- **Close Button [X]**: `width: 32px`, `height: 32px`, `borderRadius: 16px`, `alignItems: 'center'`, `justifyContent: 'center'`, `backgroundColor: transparent` (hover: `card/muted`). Icon: `X` icon `size: 16px`.

### F. Right-Side Overlay Views (Preferences, Profile, Map, Theme)
When the user clicks **Preferences**, **Theme Settings**, **My Profile**, or **My Map** from the profile menu or bottom navigation:
- The content replaces/overlays the Right Viewport workspace while keeping the left sidebar intact.
- A standardized top header bar is rendered with the view's name (e.g. `Preferences`, `Contact Info`, `Theme Settings`, `My Map`) on the left and the `[X]` close button on the right.
- Clicking `[X]` returns to the default main view (e.g. `ChatArea` or `My Calendar`).

---

## 📱 5. Responsive Breakpoint Rules

- **Desktop (`width >= 768px`)**:
  - Split 2-pane view active. Left sidebar fixed at `320px`, Right viewport `flex: 1`.
- **Mobile Web & Native APK (`width < 768px`)**:
  - Single column mode.
  - List View shows the Top Logo button (`Command` icon in primary purple box) to open the `AppNavigationDrawer`.
  - Tapping a card opens the Detail View / Full Calendar with a top header `< Back to List` button and `[X]` close button.

---

## 💻 6. Boilerplate Template for Any New Menu Screen

To create an identical screen for another menu item (e.g., `EmailScreen`, `FilesScreen`, `TasksScreen`):

```tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Pressable, Text, Platform } from 'react-native';
import { Search, Mail, X, ChevronLeft } from 'lucide-react-native';
import { useTheme } from 'amogamobileds-v1';

export function ExampleAppView({ rightOverlayView, onCloseRightPane }: { rightOverlayView?: React.ReactNode; onCloseRightPane?: () => void }) {
  const { colors, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedId, setSelectedId] = useState('item-1');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Left Sidebar */}
      <View style={[styles.sidebar, { borderRightColor: colors.border, backgroundColor: colors.background }]}>
        {/* Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
          {['inbox', 'starred', 'sent', 'archive'].map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
              <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                {tab.toUpperCase()}
              </Text>
              {activeTab === tab && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <View style={[styles.searchWrapper, { borderColor: colors.border, backgroundColor: isDark ? colors.card : colors.background }]}>
            <Search size={14} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        {/* Cards */}
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
          {/* Card Items mapping */}
        </ScrollView>
      </View>

      {/* 2. Right Detail Viewport */}
      <View style={styles.rightViewport}>
        {rightOverlayView ? (
          rightOverlayView
        ) : (
          <>
            {/* Right Header Bar */}
            <View style={[styles.rightHeaderBar, { borderBottomColor: colors.border }]}>
              <Text style={[styles.rightHeaderTitle, { color: colors.foreground }]}>My Calendar</Text>
              {onCloseRightPane && (
                <Pressable onPress={onCloseRightPane} style={styles.closeBtn}>
                  <X size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>
            {/* Main Interactive Canvas */}
            <View style={styles.mainCanvas}>
              {/* Content */}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', width: '100%', height: '100%', overflow: 'hidden' },
  sidebar: { width: 320, height: '100%', borderRightWidth: 1, flexDirection: 'column' },
  tabsRow: { height: 44, borderBottomWidth: 1, paddingHorizontal: 12, paddingTop: 10, flexDirection: 'row', gap: 18 },
  tabBtn: { paddingBottom: 8, position: 'relative' },
  tabLabel: { fontSize: 13, fontFamily: 'Open Sans' },
  activeIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, borderRadius: 9999 },
  searchSection: { paddingHorizontal: 12, paddingVertical: 10 },
  searchWrapper: { height: 36, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 12.5,
    fontFamily: 'Open Sans',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0, outline: 'none' } as any }),
  },
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingBottom: 16, gap: 4 },
  rightViewport: { flex: 1, height: '100%', flexDirection: 'column' },
  rightHeaderBar: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  rightHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Open Sans',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCanvas: {
    flex: 1,
  },
});
```

ok ok 