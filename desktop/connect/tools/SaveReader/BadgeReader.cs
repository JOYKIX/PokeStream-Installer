// SPDX-License-Identifier: GPL-3.0-or-later
using PKHeX.Core;

// Indices match PokeStream's regional badge catalog. These are flags, never counts.
internal static class BadgeReader {
    private static int[] Bits(int mask)=>Enumerable.Range(0,8).Where(i=>(mask&(1<<i))!=0).ToArray();
    internal static readonly uint[] PaldeaKeys=[
        0x89306FE6,0xB4C3AFE6,0x8205ECAD,0xA803FAAD,0xF90EFD79,0xCDA61DED,0x3B819021,0x46B6CB30,
        0xA6CDE603,0x9C16DA94,0x0D0602DE,0xBDAC74B3,0xEC7361B7,
        0x6C29ACC5,0x9C6FF7DD,0x71DB2CEB,0xE1271327,0x2A3AC89A];
    public static int[]? Read(SaveFile save)=>save switch {
        SAV1 s=>Bits(s.Badges),
        SAV2 s=>Bits(s.Badges), // The site's Johto catalog contains the eight Johto badges.
        SAV3 s=>Bits(s.Badges),
        SAV4 s=>Bits(s.Badges),
        SAV5 s=>Bits(s.Misc.Badges),
        SAV6 s=>Bits(s.Badges),
        SAV7b s=>Enumerable.Range(0,8).Where(i=>s.EventWork.GetFlag(EventVarType.System,12+i)).ToArray(),
        SAV7=>[],
        SAV8BS s=>Enumerable.Range(0,8).Where(i=>s.FlagWork.GetSystemFlag(124+i)).ToArray(),
        SAV8LA=>[],
        SAV9SV s=>Paldea(s),
        // SWSH's Misc.Badges is a count. Do not infer individual flags from it.
        _=>null
    };
    private static int[]? Paldea(SAV9SV save) {
        var badges=new List<int>();
        for(int i=0;i<PaldeaKeys.Length;i++) {
            // Index of acquisition: -1 means not received, 0 is the FIRST earned badge.
            if(!save.Blocks.TryGetBlock(PaldeaKeys[i],out var block) || block.Type!=SCTypeCode.Int32)return null;
            var order=(int)block.GetValue();
            if(order is <-1 or >17)return null;
            if(order>=0)badges.Add(i);
        }
        return badges.ToArray();
    }
}
