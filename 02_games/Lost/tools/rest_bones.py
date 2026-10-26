"""Affiche la pose de repos (coordonnées armature, Z vers le haut) de quelques os du chat.

Usage : blender.exe -b assets/sources/cat.blend --python tools/rest_bones.py
"""
import bpy

arm = bpy.data.objects['Armature']
names = ['Hip', 'Spine', 'Spine.002', 'Spine.004', 'Neck', 'Neck.001', 'Neck.002', 'Head', 'Mouth',
         'Tail', 'Tail.003', 'Tail.007', 'Ear', 'Ear.006', 'Thigh_front_L', 'Foot_front_L']
print('REST armature matrix_world:', [list(map(lambda v: round(v, 3), row)) for row in arm.matrix_world])
for n in names:
    b = arm.data.bones.get(n)
    if b is None:
        print('absent', n)
        continue
    h = tuple(round(v, 3) for v in b.head_local)
    t = tuple(round(v, 3) for v in b.tail_local)
    print(f'REST {n:16s} head={h} tail={t} parent={b.parent.name if b.parent else None}')
# Pose actuelle (frame courante, NLA mélangé) pour comparaison
for n in ['Neck.001', 'Neck.002', 'Head', 'Tail']:
    pb = arm.pose.bones[n]
    print(f'POSE {n:16s} head={tuple(round(v,3) for v in pb.head)} tail={tuple(round(v,3) for v in pb.tail)} rot={tuple(round(v,3) for v in pb.rotation_quaternion)}')
