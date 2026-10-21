using System.Buffers.Binary;
namespace PokeStream.Connect;

// Sword/Shield 1.3.2 only. Addresses are guest heap offsets, not host physical
// offsets. Read-only, identity checked; see SOURCES.md for the structure references.
public static class SwordShieldBattleReader {
    private const ulong StatusOffset=0x8FE9D5E0,Stride=0x7A0,BodyOffset=0x4E8;
    private static int U16(byte[] b,int offset)=>BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(offset));
    public static PartyFrame Read(PartyFrame field,SwitchProfile profile,ulong heap,Func<ulong,int,byte[]> read) {
        if(profile.Layout!="swsh" || profile.Version!="1.3.2")return field;
        try {
            ulong phaseAddress=checked(heap+(profile.Game=="galar-shield"?0x3F128626UL:0x3F128624UL));
            bool Active()=>read(phaseAddress,1)[0] is 0x40 or 0x41;
            if(!Active())return field;
            var expected=field.Team.Where(p=>!p.Egg).ToArray();
            if(expected.Length==0)return field;
            PartyMember[] Capture() {
                var party=new List<PartyMember>();
                // Battle slots can differ from the field party order. Every record
                // must match exactly one owned Pokémon, including trainer ID.
                for(int i=0;i<expected.Length;i++) {
                    ulong address=checked(heap+StatusOffset+(ulong)i*Stride);
                    var status=read(address,14);
                    int species=U16(status,0),max=U16(status,2),hp=U16(status,4),item=U16(status,6),level=status[12];
                    if(max is <1 or >2047 || hp>max || level is <1 or >100 || item>4095)
                        throw new InvalidDataException("Combat en cours de mise à jour.");
                    var body=read(address+BodyOffset,344);
                    var member=ModernPartyDecoder.DecodeSwitch(body,8,battle:(level,hp,max));
                    if(member==null || member.Species!=species || member.Egg)
                        throw new InvalidDataException("Combat en cours de mise à jour.");
                    party.Add(member with {HeldItem=item});
                }
                return party.ToArray();
            }
            var first=Capture();
            if(!Active())return field;
            var latest=Capture();
            if(!Active() || !PartyIdentity.SameOrder(first,latest) ||
                !PartyIdentity.Merge(expected,latest,out var merged))return field;
            PartyIdentity.ConfirmZeros(first,latest);
            if(!PartyIdentity.Merge(expected,latest,out merged))return field;
            return field with {Team=field.Team.Select(p=>p.Egg?p:merged.Single(m=>PartyIdentity.Same(p,m))).ToArray(),FieldTeam=field.Team,InBattle=true};
        }catch(Exception e)when(e is IOException or InvalidDataException or OverflowException){
            // Unsupported battle layouts must not discard the valid field party.
            return field;
        }
    }
}
