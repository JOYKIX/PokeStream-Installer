using System.Buffers.Binary;
using System.Text;
namespace PokeStream.Connect;
public static class ClassicPartyDecoder {
    // Format data: internal species numbers to National Dex, documented in SOURCES.md.
    private static readonly int[] Gen1=[0,112,115,32,35,21,100,34,80,2,103,108,102,88,94,29,31,104,111,131,59,151,130,90,72,92,123,120,9,127,114,0,0,58,95,22,16,79,64,75,113,67,122,106,107,24,47,54,96,76,0,126,0,125,82,109,0,56,86,50,128,0,0,0,83,48,149,0,0,0,84,60,124,146,144,145,132,52,98,0,0,0,37,38,25,26,0,0,147,148,140,141,116,117,0,0,27,28,138,139,39,40,133,136,135,134,66,41,23,46,61,62,13,14,15,0,85,57,51,49,87,0,0,10,11,12,68,0,55,97,42,150,143,129,0,0,89,0,99,91,0,101,36,110,53,105,0,93,63,65,17,18,121,1,3,73,0,118,119,0,0,0,0,77,78,19,20,33,30,74,137,142,0,81,0,0,4,7,5,8,6,0,0,0,0,43,44,45,69,70,71,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    private static readonly int[] Gen3=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,290,291,292,276,277,285,286,327,278,279,283,284,320,321,300,301,352,343,344,299,324,302,339,340,370,341,342,349,350,318,319,328,329,330,296,297,309,310,322,323,363,364,365,331,332,361,362,337,338,298,325,326,311,312,303,307,308,333,334,360,355,356,315,287,288,289,316,317,357,293,294,295,366,367,368,359,353,354,336,335,369,304,305,306,351,313,314,345,346,347,348,280,281,282,371,372,373,374,375,376,377,378,379,382,383,384,380,381,385,386,358];
    private static readonly string[] Orders=["ABCD","ABDC","ACBD","ACDB","ADBC","ADCB","BACD","BADC","BCAD","BCDA","BDAC","BDCA","CABD","CADB","CBAD","CBDA","CDAB","CDBA","DABC","DACB","DBAC","DBCA","DCAB","DCBA"];
    private static ushort LE(byte[] b,int i)=>BinaryPrimitives.ReadUInt16LittleEndian(b.AsSpan(i));
    private static ushort BE(byte[] b,int i)=>BinaryPrimitives.ReadUInt16BigEndian(b.AsSpan(i));
    private static uint U32(byte[] b,int i)=>BinaryPrimitives.ReadUInt32LittleEndian(b.AsSpan(i));
    public static PartyMember DecodeGba(byte[] encrypted,int deoxysForm=0) {
        if(encrypted.Length!=100 || (encrypted[0x13]&3)!=2)throw new InvalidDataException("Pokémon GBA invalide.");
        uint pid=U32(encrypted,0),ot=U32(encrypted,4),key=pid^ot;var decoded=(byte[])encrypted.Clone();
        for(int i=32;i<80;i+=4)BinaryPrimitives.WriteUInt32LittleEndian(decoded.AsSpan(i),U32(decoded,i)^key);
        var data=(byte[])decoded.Clone();string order=Orders[pid%24];for(int i=0;i<4;i++)Array.Copy(decoded,32+i*12,data,32+(order[i]-'A')*12,12);
        int sum=0;for(int i=32;i<80;i+=2)sum+=LE(data,i);if((ushort)sum!=LE(data,28))throw new InvalidDataException("Pokémon GBA instable.");
        int raw=LE(data,32),species=raw<Gen3.Length?Gen3[raw]:0,level=data[84],hp=LE(data,86),max=LE(data,88);
        Valid(species,386,level,hp,max);
        bool egg=(U32(data,72)&0x40000000)!=0,shiny=((pid>>16)^(pid&65535)^(ot>>16)^(ot&65535))<8;
        uint unown=(pid&3)|((pid>>6)&12)|((pid>>12)&48)|((pid>>18)&192);
        int form=species==201?(int)(unown%28):species==386?deoxysForm:0;
        return new(species,Name(data.AsSpan(8,10),true),level,shiny,egg,hp,max,pid,LE(data,34),ClassicGender.Read(3,species,pid),form,ot,3);
    }
    public static PartyFrame DecodeGb(byte[] data,int generation) {
        int size=generation==1?44:48,expected=8+6*(size+22);
        if(generation is not(1 or 2)||data.Length!=expected||data[0] is <1 or >6||data[data[0]+1]!=255)throw new InvalidDataException("Équipe GB invalide.");
        var result=new PartyMember[data[0]];
        for(int slot=0;slot<result.Length;slot++){
            int start=8+slot*size;byte raw=data[start];bool egg=generation==2&&data[1+slot]==253;
            if(!egg&&data[1+slot]!=raw)throw new InvalidDataException("Équipe GB instable.");
            int species=generation==1?Gen1[raw]:raw,level=data[start+(generation==1?33:31)],hp=BE(data,start+(generation==1?1:34)),max=BE(data,start+(generation==1?34:36));
            Valid(species,generation==1?151:251,level,hp,max);int dvs=generation==2?BE(data,start+21):0;
            bool shiny=generation==2&&(dvs&0xFFF)==0xAAA&&(dvs&0x2000)!=0;
            string name=Name(data.AsSpan(8+6*size+66+11*slot,10),false);
            int form=0;
            if(generation==2&&species==201) {
                int attack=(dvs>>12)&6,defense=(dvs>>8)&6,speed=(dvs>>4)&6,special=dvs&6;
                form=((attack<<5)|(defense<<3)|(speed<<1)|(special>>1))/10;
            }
            result[slot]=new(species,name,level,shiny,egg,hp,max,HeldItem:generation==2?data[start+1]:0,
                Gender:generation==2?ClassicGender.Read(2,species,(uint)(dvs>>12)):2,Form:form,
                TrainerId:BE(data,start+(generation==1?12:6)),Generation:generation);
        }
        return new(generation==1?"kanto":"johto",result);
    }
    private static void Valid(int species,int limit,int level,int hp,int max){if(species<1||species>limit||level is <1 or >100||max is <1 or >999||hp>max)throw new InvalidDataException("Équipe incomplète.");}
    private static string Name(ReadOnlySpan<byte> data,bool gba){var result=new StringBuilder();foreach(byte b in data){
        if(b==(gba?255:80)||!gba&&b==0)break;
        char c;
        if(gba){c=b switch {>=0xBB and <=0xD4=>(char)('A'+b-0xBB),>=0xD5 and <=0xEE=>(char)('a'+b-0xD5),>=0xA1 and <=0xAA=>(char)('0'+b-0xA1),0=>' ',0x1=>'À',0x2=>'Á',0x3=>'Â',0x4=>'Ç',0x5=>'È',0x6=>'É',0x7=>'Ê',0x8=>'Ë',0x16=>'à',0x17=>'á',0x19=>'ç',0x1A=>'è',0x1B=>'é',0x1C=>'ê',0x1D=>'ë',0xAB=>'!',0xAC=>'?',0xAD=>'.',0xAE=>'-',0xB4=>'\'',0xB5=>'♂',0xB6=>'♀',_=>'?'};}
        else c=b switch{>=0x80 and <=0x99=>(char)('A'+b-0x80),>=0xA0 and <=0xB9=>(char)('a'+b-0xA0),>=0xF6=>(char)('0'+b-0xF6),0x7F=>' ',0xBA=>'é',0xE0=>'\'',0xE3=>'-',0xE6=>'?',0xE7=>'!',0xE8=>'.',0xEF=>'♂',0xF5=>'♀',_=>'?'};
        result.Append(c);
    }return result.ToString();}
}
