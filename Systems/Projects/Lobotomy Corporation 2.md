---
status: Idea
category: Games
stack: "Unity, C#"
summary: "I really want a sequel to Lobcorp, so Ill make my own"
tags: [system/projects/project]
created: "2026-05-02"
---

# Lobotomy Corporation 2

## Goals

## Stack

## Resources

```datacorejsx
return function() {
    const here = dc.useCurrentPath();
    const name = here.split("/").pop().replace(/\.md$/, "");
    const all = dc.useQuery('@page and #system/resources/resource');
    const mine = all.filter(r => {
        const ps = r.value("projects") ?? [];
        const arr = Array.isArray(ps) ? ps : [ps];
        return arr.some(p => String(p).includes(name));
    });
    if (!mine.length) return <em>No resources tagged to this project yet.</em>;
    return <dc.Table paging={20} rows={mine} columns={[
        { id: "Resource", value: r => r.$link },
        { id: "Category", value: r => String(r.value("category") ?? "") },
        { id: "Vendor",   value: r => String(r.value("vendor") ?? "") }
    ]} />;
};
```

## Notes
