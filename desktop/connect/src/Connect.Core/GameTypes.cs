namespace PokeStream.Connect;

// Value equality keeps optional type metadata from making otherwise identical reads unstable.
public readonly record struct GameTypes {
    private static readonly string[] Names=["normal","fighting","flying","poison","ground","rock","bug","ghost","steel","fire","water","grass","electric","psychic","ice","dragon","dark","fairy"];
    private readonly byte first,second;
    private GameTypes(byte first,byte second){this.first=first;this.second=second;}
    public string[] ToArray()=>first==second?[Names[first]]:[Names[first],Names[second]];
    public static GameTypes? FromNames(string[]? types) {
        if(types==null || types.Length is <1 or >2)return null;
        int a=Array.IndexOf(Names,types[0]),b=Array.IndexOf(Names,types[^1]);
        return a>=0 && b>=0?new((byte)a,(byte)b):null;
    }
    public static GameTypes? Decode(int first,int second,int generation) {
        // Gen IV keeps the unused Mystery type at 9; Gen V removes it.
        int Normalize(int value)=>generation==4 ? value==9?-1:value>9?value-1:value : value;
        if(generation is <4 or >7)return null;
        first=Normalize(first);second=Normalize(second);
        int maximum=generation>=6?17:16;
        return first>=0 && first<=maximum && second>=0 && second<=maximum
            ? new GameTypes((byte)first,(byte)second):null;
    }
    public static GameTypes? Read(Func<uint,int,byte[]> read,uint address,int generation) {
        try {var bytes=read(address,2);return bytes.Length==2?Decode(bytes[0],bytes[1],generation):null;}
        // Optional metadata must never discard a valid team or disconnect the reader.
        catch(Exception e)when(e is InvalidDataException or IOException){return null;}
    }
    public static void Confirm(PartyMember[] first,PartyMember[] latest) {
        for(int i=0;i<latest.Length;i++)
            if(first[i].Types!=latest[i].Types)latest[i]=latest[i] with {Types=null};
    }
}
