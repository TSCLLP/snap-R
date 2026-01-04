# SnapR Decision Engine Specification v1.0
## Status: 🔒 LOCKED - DO NOT MODIFY WITHOUT APPROVAL

---

## 1. OBJECTIVE

Produce a professional, MLS-ready listing with:
- Visual consistency across all photos
- Minimal over-processing
- Photographer-aligned outcomes
- Predictable costs

**The system must prefer restraint over maximal enhancement and optimize for professional perception, not visual novelty.**

---

## 2. CORE PRINCIPLES (NON-NEGOTIABLE)

1. **NOT ALL PHOTOS ARE ENHANCED**
2. **NOT ALL DEFICIENCIES ARE FIXED**
3. **CONSISTENCY > MAXIMIZATION**
4. **HERO PHOTOS GET PRIORITY**
5. **LISTING-LEVEL CAPS APPLY**

---

## 3. PHOTO ROLE CLASSIFICATION

Every photo is assigned ONE role:

| Role | % of Listing | Treatment | Examples |
|------|--------------|-----------|----------|
| `hero` | Top 15% | Full enhancement, dramatic allowed | Front exterior, kitchen, primary living |
| `supporting` | Middle 65% | Clean, consistent, not dramatic | Bedrooms, bathrooms, secondary angles |
| `utility` | Bottom 20% | Minimal or none | Laundry, garage, storage, mechanical |

### Classification Signals (Weighted)

| Signal | Weight | Notes |
|--------|--------|-------|
| Exterior front | HIGH | Always hero candidate |
| Room size | MEDIUM | Larger rooms = more important |
| Composition score | MEDIUM | Well-framed = hero potential |
| Lighting quality | MEDIUM | Good light = showcase |
| heroScore from Vision | HIGH | AI assessment |
| Upload order | MEDIUM | Early photos matter more |

---

## 4. DEFICIENCY SEVERITY SCORING

Deficiencies are scored 0-100, NOT binary.

| Severity | Range | Action |
|----------|-------|--------|
| Critical | 80-100 | Must fix if hero/supporting |
| High | 60-79 | Fix if hero, consider if supporting |
| Medium | 40-59 | Fix if hero only |
| Low | 20-39 | Optional, usually skip |
| None | 0-19 | Do not touch |

**Uncertainty Rule:** If severity confidence < 0.6, downgrade severity by one level.

### Deficiency Types
```typescript
deficiencies: {
  sky?: { severity: number, coverage: number, confidence: number }
  lawn?: { severity: number, coverage: number, confidence: number }
  lighting?: { severity: number, confidence: number }
  clutter?: { severity: number, confidence: number }
  perspective?: { severity: number, confidence: number }
  color?: { severity: number, confidence: number }
}
```

---

## 5. TOOL ELIGIBILITY MATRIX

Tools are selected based on: `role × severity × caps`

### Sky Replacement
- ✅ Apply if: `role === 'hero' AND sky.severity >= 60 AND sky.coverage >= 20%`
- ❌ Never apply to: utility photos
- 📊 Cap: `min(3, 15% of photos)`

### Lawn Repair
- ✅ Apply if: `role !== 'utility' AND lawn.severity >= 40 AND lawn.coverage >= 15%`
- 📊 Cap: `min(4, 20% of photos)`

### Virtual Twilight
- ✅ Apply to: ONE exterior photo ONLY (highest heroScore)
- ❌ Never more than 1 per listing (unless luxury tier)
- 📊 Cap: `1`

### Declutter
- ✅ Apply if: `role !== 'utility' AND clutter.severity >= 50`
- ❌ Skip personal spaces (bathrooms with toiletries)
- 📊 Cap: `30% of interiors`

### Virtual Staging
- ✅ Apply if: `room is empty AND role === 'hero'`
- 📊 Cap: `2 rooms`

### HDR / Auto-Enhance
- ✅ Apply broadly to supporting and utility
- ✅ Light touch on all photos
- 📊 Cap: `unlimited`

### TV Screen
- ❌ **DISABLED** - Too many false positives
- Manual tool only

### Fire in Fireplace
- ✅ Apply if: `hasFireplace === true AND role !== 'utility'`
- 📊 Cap: `1`

---

## 6. LISTING-LEVEL CAPS (Default)

| Tool | Cap Formula |
|------|-------------|
| Sky Replacement | `min(3, ceil(totalPhotos * 0.15))` |
| Lawn Repair | `min(4, ceil(totalPhotos * 0.20))` |
| Declutter | `ceil(interiorPhotos * 0.30)` |
| Virtual Staging | `2` |
| Twilight | `1` |
| Fire in Fireplace | `1` |
| HDR | `unlimited` |
| Pool Enhance | `min(2, poolPhotos)` |

---

## 7. CONSISTENCY LOCKING

Once a tool is applied the first time, lock its style:
```typescript
lockedPresets = {
  skyType: 'soft-blue' | 'dramatic-clouds' | 'sunset',
  twilightTone: 'blue-hour' | 'golden-hour' | 'dusk',
  lawnGreen: 'natural' | 'vibrant' | 'golf-course',
  hdrStrength: 'light' | 'balanced' | 'dramatic',
  stagingStyle: 'modern' | 'traditional' | 'minimalist'
}
```

All subsequent applications MUST reuse these presets.

---

## 8. DECISION TRANSPARENCY

### Internal (for debugging)
```typescript
{
  photoId: "xxx",
  role: "hero",
  decisions: [
    { tool: "sky-replacement", reason: "Hero exterior, sky severity 78, coverage 35%" }
  ]
}
```

### External (user-facing)
- ✅ "Prepared for MLS consistency"
- ❌ Never expose tool names or mechanics

---

## 9. WHAT IS FORBIDDEN

| ❌ Forbidden | Reason |
|--------------|--------|
| Sky replacement on utility photos | Waste of resources |
| Multiple twilight photos | Looks unprofessional |
| TV screen auto-detection | Too many hallucinations |
| Declutter in bathrooms | Personal items expected |
| Staging more than 2 rooms | Over-processed look |
| Ignoring caps | Cost explosion |

---

## 10. GLOBAL SAFETY OVERRIDES

- The system must allow a global per-listing enhancement limit override
- Overrides may be applied due to cost, performance, or trust signals
- Admin can set `maxEnhancementsPerListing` to hard-cap total tool applications
- Trust signals (new user, free tier, suspicious patterns) can trigger conservative mode

---

*Specification Locked: January 4, 2026*
*Version: 1.0*
