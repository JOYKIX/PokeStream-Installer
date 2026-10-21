// SPDX-License-Identifier: GPL-3.0-or-later
using PKHeX.Core;
static class BadgeFixtures {
    public static int[]? Set(SaveFile save) {
        const int mask=(1<<1)|(1<<6);
        switch(save) {
            case SAV1 s:s.Badges=mask;break;
            case SAV2 s:s.Badges=mask | (1<<10);break;
            case SAV3 s:s.Badges=mask;break;
            case SAV4 s:s.Badges=mask;break;
            case SAV5 s:s.Misc.Badges=mask;break;
            case SAV6 s:s.Badges=mask;break;
            case SAV7b s:
                for(int i=0;i<8;i++)s.EventWork.SetFlag(EventVarType.System,12+i,i is 1 or 6);break;
            case SAV7:return [];
            case SAV8BS s:
                for(int i=0;i<8;i++)s.FlagWork.SetSystemFlag(124+i,i is 1 or 6);break;
            case SAV8LA:return [];
            case SAV9SV s:
                int order=0;
                foreach(uint key in BadgeReader.PaldeaKeys){
                    var b=s.Blocks.GetBlock(key);
                    typeof(SCBlock).GetProperty("Type")!.SetValue(b,SCTypeCode.Int32);
                    b.SetValue(Array.IndexOf(BadgeReader.PaldeaKeys,key) is 1 or 8 or 16 ? order++ : -1);
                }
                return [1,8,16];
            default:return null;
        }
        return [1,6];
    }
}
