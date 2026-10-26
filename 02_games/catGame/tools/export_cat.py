import bpy, sys, os

out = sys.argv[sys.argv.index("--") + 1]

keep = {"Armature", "Cat", "Sphere", "Sphere.001"}
for o in list(bpy.data.objects):
    if o.name not in keep:
        bpy.data.objects.remove(o, do_unlink=True)

cat = bpy.data.objects["Cat"]
cat.name = "CatBody"
bpy.data.objects["Sphere"].name = "EyeA"
bpy.data.objects["Sphere.001"].name = "EyeB"

# Particle hair is not representable in glTF: drop the modifiers so export_apply does not choke on them.
for o in (cat,):
    for md in list(o.modifiers):
        if md.type == "PARTICLE_SYSTEM":
            o.modifiers.remove(md)

def principled(name, image=None, color=(1, 1, 1, 1), rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Base Color"].default_value = color
    nt.links.new(bsdf.outputs["BSDF"], outn.inputs["Surface"])
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m

skin_img = bpy.data.images["Untitled"]
skin_img.name = "cat_skin"
skin = principled("cat_skin", image=skin_img, rough=0.85)
eye = principled("cat_eye", color=(0.35, 0.6, 0.2, 1), rough=0.15)

# Body: all slots -> skin (hair/whisker slots have no faces once particles are gone)
cat.data.materials.clear()
cat.data.materials.append(skin)
for name in ("EyeA", "EyeB"):
    o = bpy.data.objects[name]
    o.data.materials.clear()
    o.data.materials.append(eye)

arm = bpy.data.objects["Armature"]
arm.name = "CatArmature"
ad = arm.animation_data
ad.action = None
for t in list(ad.nla_tracks):
    ad.nla_tracks.remove(t)
for act in ("Walk", "run"):
    a = bpy.data.actions[act]
    t = ad.nla_tracks.new()
    t.name = act
    t.strips.new(act, int(a.frame_range[0]), a)

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_bake_animation=True,
    export_def_bones=False,
    export_skins=True,
    export_morph=False,
    export_image_format="JPEG",
    export_jpeg_quality=85,
    export_yup=True,
)
print("EXPORTED", out, os.path.getsize(out), "bytes")
