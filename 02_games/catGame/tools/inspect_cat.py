import bpy

print("=== BLEND", bpy.data.filepath, "version", bpy.data.version)
print("=== OBJECTS")
for o in bpy.data.objects:
    extra = ""
    if o.type == "MESH":
        m = o.data
        extra = f"verts={len(m.vertices)} polys={len(m.polygons)} shapekeys={len(m.shape_keys.key_blocks) if m.shape_keys else 0} mods={[md.type for md in o.modifiers]} psys={[ (p.name, p.settings.type, p.settings.count, p.settings.hair_length) for p in o.particle_systems]}"
    if o.type == "ARMATURE":
        extra = f"bones={len(o.data.bones)}"
    print(f"  {o.name} type={o.type} parent={o.parent.name if o.parent else None} {extra}")

print("=== ARMATURES")
for a in bpy.data.armatures:
    print(" armature", a.name, "bones", len(a.bones))
    def walk(b, depth):
        print("   " + "  " * depth + f"{b.name} (deform={b.use_deform}, len={b.length:.3f})")
        for c in b.children:
            walk(c, depth + 1)
    for b in a.bones:
        if b.parent is None:
            walk(b, 0)

print("=== ACTIONS")
for act in bpy.data.actions:
    groups = sorted({fc.group.name if fc.group else "?" for fc in act.fcurves})
    print(f"  {act.name} frames={act.frame_range[0]:.0f}-{act.frame_range[1]:.0f} fcurves={len(act.fcurves)} users={act.users} bones={groups[:20]}{'...' if len(groups)>20 else ''}")

print("=== ANIM ASSIGNMENTS")
for o in bpy.data.objects:
    if o.animation_data:
        ad = o.animation_data
        print(f"  {o.name}: action={ad.action.name if ad.action else None} nla_tracks={[ (t.name, [s.action.name for s in t.strips if s.action]) for t in ad.nla_tracks]}")

print("=== POSE BONES WITH CONSTRAINTS / CUSTOM PROPS")
for o in bpy.data.objects:
    if o.type == "ARMATURE" and o.pose:
        for pb in o.pose.bones:
            cons = [c.type for c in pb.constraints]
            props = [k for k in pb.keys() if not k.startswith("_")]
            if cons or props:
                print(f"  {pb.name}: constraints={cons} props={props}")

print("=== MATERIALS / IMAGES")
for m in bpy.data.materials:
    print("  mat", m.name, "users", m.users, "nodes", m.use_nodes)
for i in bpy.data.images:
    print("  img", i.name, i.size[:], "packed" if i.packed_file else i.filepath)

print("=== SCENE")
s = bpy.context.scene
print("  frames", s.frame_start, s.frame_end, "fps", s.render.fps)
print("=== TEXTS")
for t in bpy.data.texts:
    print("  text", t.name, len(t.as_string()), "chars")
